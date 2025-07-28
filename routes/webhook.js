const express = require('express');
const router = express.Router();
const { flutterwaveService } = require('../services/flutterwaveService');
const { walletService } = require('../services/walletService');
const { supabase } = require('../config/supabase');
const { realtimeHandler } = require('../utils/realtimeHandler');
const { generateResponse } = require('../utils/helpers');

// Raw body middleware for webhook signature verification
const getRawBody = (req, res, next) => {
  // Only process raw body for webhook endpoints that need signature verification
  if (req.originalUrl.includes('/payment/webhook')) {
    let rawBody = '';
    req.setEncoding('utf8');
    
    req.on('data', chunk => {
      rawBody += chunk;
    });
    
    req.on('end', () => {
      try {
        // Store raw body for signature verification
        req.rawBody = rawBody;
        
        // Parse JSON body
        if (rawBody) {
          req.body = JSON.parse(rawBody);
        }
        
        next();
      } catch (error) {
        console.error('❌ Error parsing webhook payload:', error.message);
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid JSON payload' 
        });
      }
    });
    
    req.on('error', (error) => {
      console.error('❌ Error reading webhook body:', error);
      return res.status(400).json({ 
        success: false, 
        message: 'Error reading request body' 
      });
    });
  } else {
    next();
  }
};

// Apply raw body middleware
router.use(getRawBody);

// Flutterwave Webhook endpoint - Secure with signature verification and idempotency
router.post('/api/v1/payment/webhook', async (req, res) => {
  const webhookStartTime = Date.now();
  const eventId = req.body?.data?.id || `webhook_${Date.now()}`;
  
  try {
    console.log('📥 Flutterwave webhook received:', {
      event: req.body?.event,
      eventId,
      txRef: req.body?.data?.tx_ref,
      timestamp: new Date().toISOString()
    });

    // Store webhook in database for tracking
    const { data: webhookRecord } = await supabase
      .from('flutterwave_webhooks')
      .insert({
        event: req.body?.event || 'unknown',
        event_id: eventId,
        tx_ref: req.body?.data?.tx_ref,
        flw_ref: req.body?.data?.flw_ref,
        status: req.body?.data?.status || 'unknown',
        payload: req.body,
        signature_verified: false,
        processed: false,
        user_id: req.body?.data?.meta?.user_id,
        amount: req.body?.data?.amount,
        currency: req.body?.data?.currency
      })
      .select()
      .single();

    // Verify webhook signature for security
    const signature = req.headers['verif-hash'];
    const isSignatureValid = flutterwaveService.verifyWebhookSignature(signature, req.body);
    
    // Update webhook record with signature verification status
    if (webhookRecord) {
      await supabase
        .from('flutterwave_webhooks')
        .update({ signature_verified: isSignatureValid })
        .eq('id', webhookRecord.id);
    }

    if (!isSignatureValid) {
      console.error('❌ Invalid webhook signature:', {
        eventId,
        signature: signature?.substring(0, 10) + '...',
        expected: 'sha256_hash'
      });
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }

    // Process webhook event with enhanced service
    const result = await flutterwaveService.processWebhookEvent(req.body);
    
    if (!result.success) {
      console.error('❌ Webhook processing failed:', {
        eventId,
        error: result.message,
        txRef: req.body?.data?.tx_ref
      });
      
      // Update webhook record with error
      if (webhookRecord) {
        await supabase
          .from('flutterwave_webhooks')
          .update({ 
            error_message: result.message,
            processing_attempts: 1
          })
          .eq('id', webhookRecord.id);
      }
      
      return res.status(400).json({ success: false, message: result.message });
    }

    // Handle wallet credit action
    if (result.action === 'credit_wallet') {
      const { txRef, amount, userId, flwRef, customer } = result.data;
      
      if (!userId) {
        console.error('❌ User ID missing in webhook meta data:', {
          eventId,
          txRef,
          metaData: req.body?.data?.meta
        });
        return res.status(400).json({ success: false, message: 'User ID missing in meta data' });
      }

      // Check if transaction was already processed (idempotency)
      const alreadyProcessed = await walletService.isTransactionProcessed(txRef);
      if (alreadyProcessed) {
        console.log('ℹ️ Transaction already processed:', {
          eventId,
          txRef,
          message: 'Duplicate webhook - transaction already credited'
        });
        
        // Mark webhook as processed
        if (webhookRecord) {
          await supabase
            .from('flutterwave_webhooks')
            .update({ 
              processed: true,
              processed_at: new Date().toISOString()
            })
            .eq('id', webhookRecord.id);
        }
        
        return res.json({ success: true, message: 'Transaction already processed' });
      }

      console.log('💰 Processing wallet credit:', {
        eventId,
        userId,
        amount,
        txRef,
        flwRef
      });

      // Credit user's wallet
      const creditResult = await walletService.creditWallet(
        userId, 
        amount, 
        `Wallet funding via Flutterwave (webhook) - ${txRef}`, 
        txRef
      );

      // Update payment log
      const { error: paymentLogError } = await supabase
        .from('payment_logs')
        .update({
          status: 'completed',
          flw_ref: flwRef,
          webhook_data: result.data,
          updated_at: new Date().toISOString()
        })
        .eq('tx_ref', txRef);

      if (paymentLogError) {
        console.error('❌ Failed to update payment log:', {
          eventId,
          txRef,
          error: paymentLogError.message
        });
      }

      // Update transaction status
      const { error: transactionError } = await supabase
        .from('transactions')
        .update({
          status: 'completed',
          metadata: {
            flw_ref: flwRef,
            webhook_processed_at: new Date().toISOString(),
            event_id: eventId
          },
          updated_at: new Date().toISOString()
        })
        .eq('payment_reference', txRef)
        .eq('user_id', userId);

      if (transactionError) {
        console.error('❌ Failed to update transaction:', {
          eventId,
          txRef,
          error: transactionError.message
        });
      }

      // Send real-time notification
      try {
        if (typeof realtimeHandler !== 'undefined' && realtimeHandler.sendNotification) {
          await realtimeHandler.sendNotification(userId, {
            title: 'Wallet Funded Successfully',
            message: `₦${Number(amount).toLocaleString()} has been added to your wallet successfully.`,
            type: 'wallet_funding',
            data: { 
              amount, 
              txRef, 
              flwRef,
              newBalance: creditResult.new_balance,
              timestamp: new Date().toISOString()
            }
          });
        }
      } catch (notificationError) {
        console.error('❌ Failed to send notification:', {
          eventId,
          userId,
          error: notificationError.message
        });
      }

      // Send real-time balance update
      try {
        if (typeof realtimeHandler !== 'undefined' && realtimeHandler.sendBalanceUpdate) {
          realtimeHandler.sendBalanceUpdate(userId, creditResult.new_balance);
        }
      } catch (balanceUpdateError) {
        console.error('❌ Failed to send balance update:', {
          eventId,
          userId,
          error: balanceUpdateError.message
        });
      }

      // Mark webhook as processed
      if (webhookRecord) {
        await supabase
          .from('flutterwave_webhooks')
          .update({ 
            processed: true,
            processed_at: new Date().toISOString()
          })
          .eq('id', webhookRecord.id);
      }

      const processingTime = Date.now() - webhookStartTime;
      console.log('✅ Webhook processed successfully:', {
        eventId,
        txRef,
        userId,
        amount,
        newBalance: creditResult.new_balance,
        processingTimeMs: processingTime
      });
    }

    res.json({ 
      success: true, 
      message: result.message || 'Webhook processed successfully',
      eventId,
      processingTimeMs: Date.now() - webhookStartTime
    });

  } catch (error) {
    const processingTime = Date.now() - webhookStartTime;
    console.error('❌ Webhook processing error:', {
      eventId,
      error: error.message,
      stack: error.stack,
      processingTimeMs: processingTime,
      payload: req.body
    });
    
    // Update webhook record with error
    try {
      await supabase
        .from('flutterwave_webhooks')
        .update({ 
          error_message: error.message,
          processing_attempts: 1
        })
        .eq('event_id', eventId);
    } catch (updateError) {
      console.error('❌ Failed to update webhook error:', updateError.message);
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      eventId,
      processingTimeMs: processingTime
    });
  }
});

module.exports = router;
