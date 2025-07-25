const { flutterwaveService } = require('../services/flutterwaveService');
const { walletService } = require('../services/walletService');
const { supabase } = require('../config/supabase');
const { generateResponse } = require('../utils/helpers');
const { realtimeHandler } = require('../utils/realtimeHandler');

class PaymentController {

    // Initiate Flutterwave payment
    async initiatePayment(req, res) {
        try {
            const userId = req.user.id;
            const { amount, redirect_url } = req.body;

            if (!amount || amount <= 0) {
                return res.status(400).json(generateResponse(false, 'Invalid payment amount'));
            }

            if (amount < 100) {
                return res.status(400).json(generateResponse(false, 'Minimum payment amount is ₦100'));
            }

            // Get user details
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('email, full_name, phone')
                .eq('id', userId)
                .single();

            if (userError || !user) {
                return res.status(404).json(generateResponse(false, 'User not found'));
            }

            // Check if wallet exists, create if not
            let wallet;
            try {
                wallet = await walletService.getWallet(userId);
            } catch (error) {
                // Create wallet if it doesn't exist
                wallet = await walletService.createWallet(userId);
            }

            // Create payment link with Flutterwave
            const paymentResult = await flutterwaveService.createPaymentLink({
                amount: amount,
                userId: userId,
                userEmail: user.email,
                userName: user.full_name || 'Customer',
                userPhone: user.phone,
                description: `Wallet funding - ₦${amount}`,
                redirectUrl: redirect_url
            });

            if (!paymentResult.success) {
                return res.status(500).json(generateResponse(false, 'Failed to create payment link'));
            }

            // Log payment initiation
            const { data: paymentLog, error: logError } = await supabase
                .from('payment_logs')
                .insert({
                    user_id: userId,
                    tx_ref: paymentResult.txRef,
                    amount: parseFloat(amount),
                    status: 'initiated',
                    payment_data: {
                        payment_link: paymentResult.paymentLink,
                        flw_data: paymentResult.data
                    },
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (logError) {
                console.error('Payment log error:', logError);
            }

            // Create pending transaction record
            const { data: transaction, error: transactionError } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'credit',
                    amount: parseFloat(amount),
                    description: `Wallet funding via Flutterwave - ₦${amount}`,
                    status: 'pending',
                    payment_reference: paymentResult.txRef,
                    payment_method: 'flutterwave',
                    metadata: {
                        payment_link: paymentResult.paymentLink,
                        initiated_at: new Date().toISOString()
                    },
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (transactionError) {
                console.error('Transaction record error:', transactionError);
            }

            console.log('🚀 Payment initiated successfully:', paymentResult.txRef);

            res.json(generateResponse(true, 'Payment link created successfully', {
                paymentLink: paymentResult.paymentLink,
                txRef: paymentResult.txRef,
                amount: amount,
                transaction: transaction
            }));

        } catch (error) {
            console.error('Payment initiation error:', error);
            res.status(500).json(generateResponse(false, error.message || 'Payment initiation failed'));
        }
    }

    // Handle payment callback/success
    async handlePaymentCallback(req, res) {
        try {
            const { tx_ref, status, transaction_id } = req.query;

            if (!tx_ref) {
                return res.status(400).json(generateResponse(false, 'Transaction reference is required'));
            }

            console.log('📞 Payment callback received:', { tx_ref, status, transaction_id });

            // Get payment log
            const { data: paymentLog, error: logError } = await supabase
                .from('payment_logs')
                .select('*')
                .eq('tx_ref', tx_ref)
                .single();

            if (logError || !paymentLog) {
                console.error('Payment log not found:', tx_ref);
                return res.status(404).json(generateResponse(false, 'Payment record not found'));
            }

            // If payment is already processed, return success
            if (paymentLog.status === 'completed') {
                return res.json(generateResponse(true, 'Payment already processed', {
                    txRef: tx_ref,
                    status: 'success',
                    amount: paymentLog.amount
                }));
            }

            // Verify payment with Flutterwave
            let verification;
            if (transaction_id) {
                verification = await flutterwaveService.verifyTransactionById(transaction_id);
            } else {
                verification = await flutterwaveService.verifyTransactionByRef(tx_ref);
            }

            if (verification.status !== 'success' || verification.data.status !== 'successful') {
                // Update payment log as failed
                await supabase
                    .from('payment_logs')
                    .update({
                        status: 'failed',
                        webhook_data: verification,
                        updated_at: new Date().toISOString()
                    })
                    .eq('tx_ref', tx_ref);

                return res.status(400).json(generateResponse(false, 'Payment verification failed'));
            }

            // Check if transaction was already processed to prevent double crediting
            const alreadyProcessed = await walletService.isTransactionProcessed(tx_ref);
            if (alreadyProcessed) {
                return res.json(generateResponse(true, 'Payment already processed', {
                    txRef: tx_ref,
                    status: 'success',
                    amount: verification.data.amount
                }));
            }

            // Credit user's wallet
            const creditResult = await walletService.creditWallet(
                paymentLog.user_id,
                verification.data.amount,
                `Wallet funding via Flutterwave - ${tx_ref}`,
                tx_ref
            );

            // Update payment log as completed
            await supabase
                .from('payment_logs')
                .update({
                    status: 'completed',
                    flw_ref: verification.data.flw_ref,
                    webhook_data: verification.data,
                    updated_at: new Date().toISOString()
                })
                .eq('tx_ref', tx_ref);

            // Update transaction status
            await supabase
                .from('transactions')
                .update({
                    status: 'completed',
                    metadata: {
                        ...paymentLog.payment_data,
                        flw_ref: verification.data.flw_ref,
                        completed_at: new Date().toISOString(),
                        verification_data: verification.data
                    },
                    updated_at: new Date().toISOString()
                })
                .eq('payment_reference', tx_ref)
                .eq('user_id', paymentLog.user_id);

            // Send real-time notification
            if (typeof realtimeHandler !== 'undefined' && realtimeHandler.sendNotification) {
                await realtimeHandler.sendNotification(paymentLog.user_id, {
                    title: 'Wallet Funded',
                    message: `₦${Number(verification.data.amount).toLocaleString()} added to your wallet successfully.`,
                    type: 'wallet',
                    data: { 
                        amount: verification.data.amount, 
                        txRef: tx_ref,
                        newBalance: creditResult.new_balance
                    }
                });
            }

            // Send real-time balance update
            if (typeof realtimeHandler !== 'undefined' && realtimeHandler.sendBalanceUpdate) {
                realtimeHandler.sendBalanceUpdate(paymentLog.user_id, creditResult.new_balance);
            }

            console.log('✅ Payment processed successfully:', tx_ref);

            res.json(generateResponse(true, 'Payment processed successfully', {
                txRef: tx_ref,
                status: 'success',
                amount: verification.data.amount,
                newBalance: creditResult.new_balance
            }));

        } catch (error) {
            console.error('Payment callback error:', error);
            res.status(500).json(generateResponse(false, error.message || 'Payment processing failed'));
        }
    }

    // Get payment status
    async getPaymentStatus(req, res) {
        try {
            const { tx_ref } = req.params;
            const userId = req.user.id;

            if (!tx_ref) {
                return res.status(400).json(generateResponse(false, 'Transaction reference is required'));
            }

            // Get payment log
            const { data: paymentLog, error: logError } = await supabase
                .from('payment_logs')
                .select('*')
                .eq('tx_ref', tx_ref)
                .eq('user_id', userId)
                .single();

            if (logError || !paymentLog) {
                return res.status(404).json(generateResponse(false, 'Payment record not found'));
            }

            // Get transaction record
            const { data: transaction, error: transactionError } = await supabase
                .from('transactions')
                .select('*')
                .eq('payment_reference', tx_ref)
                .eq('user_id', userId)
                .single();

            res.json(generateResponse(true, 'Payment status retrieved', {
                txRef: tx_ref,
                status: paymentLog.status,
                amount: paymentLog.amount,
                createdAt: paymentLog.created_at,
                updatedAt: paymentLog.updated_at,
                transaction: transaction,
                flwRef: paymentLog.flw_ref
            }));

        } catch (error) {
            console.error('Get payment status error:', error);
            res.status(500).json(generateResponse(false, 'Failed to get payment status'));
        }
    }
}

module.exports = new PaymentController();
