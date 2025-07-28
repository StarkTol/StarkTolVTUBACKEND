const { flutterwaveService } = require('../services/flutterwaveService');
const { walletService } = require('../services/walletService');
const { supabase, supabaseAdmin } = require('../config/supabaseClient');
const { generateResponse } = require('../utils/helpers');
const { realtimeHandler } = require('../utils/realtimeHandler');
const { notificationService } = require('../services/notificationService');

class WalletController {

    // Fund wallet with various payment methods including Flutterwave
    async fundWallet(req, res) {
        try {
            const userId = req.user.id;
            const { amount, method, metadata } = req.body;

            if (!amount || amount <= 0) {
                return res.status(400).json(generateResponse(false, 'Invalid funding amount'));
            }

            if (amount < 100) {
                return res.status(400).json(generateResponse(false, 'Minimum funding amount is ₦100'));
            }

            if (!method) {
                return res.status(400).json(generateResponse(false, 'Payment method is required'));
            }

            // Check if wallet exists, create if not
            let wallet;
            try {
                wallet = await walletService.getWallet(userId);
            } catch (error) {
                // Create wallet if it doesn't exist
                wallet = await walletService.createWallet(userId);
            }

            // Handle Flutterwave payment initiation (new approach)
            if (method === 'flutterwave') {
                // Get user details for payment
                const { data: user, error: userError } = await supabase
                    .from('users')
                    .select('email, full_name, phone')
                    .eq('id', userId)
                    .single();

                if (userError || !user) {
                    return res.status(404).json(generateResponse(false, 'User details not found'));
                }

                // Create payment link using Flutterwave service
                const paymentResult = await flutterwaveService.createPaymentLink({
                    amount: amount,
                    userId: userId,
                    userEmail: user.email,
                    userName: user.full_name || 'Customer',
                    userPhone: user.phone,
                    description: `Wallet funding - ₦${amount}`,
                    redirectUrl: metadata?.redirectUrl
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

                return res.json(generateResponse(true, 'Payment link created successfully', {
                    paymentLink: paymentResult.paymentLink,
                    txRef: paymentResult.txRef,
                    amount: amount,
                    method: 'flutterwave'
                }));
            }

            // Handle Flutterwave verification (legacy method for backward compatibility)
            if (method === 'flutterwave_verify') {
                if (!metadata || !metadata.transactionId || !metadata.txRef) {
                    return res.status(400).json(generateResponse(false, 'Flutterwave transaction details are required'));
                }

                // Check if transaction was already processed
                const alreadyProcessed = await walletService.isTransactionProcessed(metadata.txRef);
                if (alreadyProcessed) {
                    return res.status(400).json(generateResponse(false, 'Transaction already processed'));
                }

                // Verify transaction with Flutterwave
                const verification = await flutterwaveService.verifyTransactionById(metadata.transactionId);
                
                if (verification.status !== 'success' || !verification.data || verification.data.status !== 'successful') {
                    return res.status(400).json(generateResponse(false, verification.message || 'Payment verification failed'));
                }

                // Verify amount matches
                if (parseFloat(verification.data.amount) !== parseFloat(amount)) {
                    return res.status(400).json(generateResponse(false, 'Amount mismatch'));
                }

                // Verify transaction reference matches
                if (verification.data.tx_ref !== metadata.txRef) {
                    return res.status(400).json(generateResponse(false, 'Transaction reference mismatch'));
                }

                // Credit wallet
                const creditResult = await walletService.creditWallet(
                    userId, 
                    amount, 
                    'Wallet funding via Flutterwave', 
                    metadata.txRef
                );

                // Send real-time update
                if (typeof realtimeHandler !== 'undefined' && realtimeHandler.sendBalanceUpdate) {
                    realtimeHandler.sendBalanceUpdate(userId, creditResult.new_balance);
                }

                return res.json(generateResponse(true, 'Wallet funded successfully', {
                    transactionId: verification.data.id,
                    reference: metadata.txRef,
                    status: 'success',
                    new_balance: creditResult.new_balance
                }));

                // Send wallet credit notification
                await notificationService.sendWalletCreditNotification(userId, {
                    amount: amount,
                    reference: metadata.txRef,
                    payment_method: method,
                    new_balance: creditResult.new_balance
                });
            }

            // Handle other payment methods (card, bank_transfer, etc.)
            return res.status(400).json(generateResponse(false, 'Unsupported payment method'));

        } catch (error) {
            console.error('Fund wallet error:', error);
            return res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }
    // Get wallet balance and details
    async getWallet(req, res) {
        try {
            const userId = req.user.id;

            const { data: walletData, error } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error || !walletData) {
                return res.status(404).json(generateResponse(false, 'Wallet not found'));
            }

            res.json(generateResponse(true, 'Wallet retrieved successfully', walletData));

        } catch (error) {
            console.error('Get wallet error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Initialize payment for wallet deposit
    async initiateDeposit(req, res) {
        try {
            const userId = req.user.id;
            const { amount } = req.body;

            if (!amount || amount <= 0) {
                return res.status(400).json(generateResponse(false, 'Invalid deposit amount'));
            }

            const depositAmount = parseFloat(amount);
            const minDeposit = parseFloat(process.env.MIN_DEPOSIT || '100');
            
            if (depositAmount < minDeposit) {
                return res.status(400).json(generateResponse(false, `Minimum deposit amount is ₦${minDeposit}`));
            }

            // Get user details
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id, email, full_name, phone')
                .eq('id', userId)
                .single();

            if (userError || !userData) {
                return res.status(404).json(generateResponse(false, 'User not found'));
            }

            // Check if wallet exists
            const { data: walletData, error: walletError } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (walletError || !walletData) {
                return res.status(404).json(generateResponse(false, 'Wallet not found'));
            }

            // Initialize payment with Flutterwave
            const paymentData = {
                amount: depositAmount,
                email: userData.email,
                phone_number: userData.phone,
                name: userData.full_name,
                title: 'Wallet Deposit',
                description: `Wallet deposit of ₦${depositAmount}`,
                metadata: {
                    user_id: userId,
                    type: 'wallet_deposit',
                    amount: depositAmount
                }
            };

            // Create payment link using Flutterwave service
            const paymentResult = await flutterwaveService.createPaymentLink({
                amount: depositAmount,
                userId: userId,
                userEmail: userData.email,
                userName: userData.full_name || 'Customer',
                userPhone: userData.phone,
                description: `Wallet deposit of ₦${depositAmount}`,
                redirectUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/wallet/deposit/success`
            });

            if (!paymentResult.success) {
                return res.status(500).json(generateResponse(false, 'Failed to create payment link'));
            }

            // Create pending transaction record
            const { data: transactionData, error: transactionError } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'deposit',
                    amount: depositAmount,
                    description: `Wallet deposit via Flutterwave`,
                    status: 'pending',
                    payment_method: 'flutterwave',
                    payment_reference: paymentResult.txRef,
                    balance_before: parseFloat(walletData.balance),
                    balance_after: parseFloat(walletData.balance), // Will be updated on success
                    metadata: {
                        flutterwave_reference: paymentResult.txRef,
                        payment_link: paymentResult.paymentLink
                    }
                })
                .select()
                .single();

            if (transactionError) {
                console.error('Transaction record error:', transactionError);
            }

            res.json(generateResponse(true, 'Payment initialized successfully', {
                payment_link: paymentResult.paymentLink,
                tx_ref: paymentResult.txRef,
                amount: depositAmount,
                transaction: transactionData
            }));

        } catch (error) {
            console.error('Initialize deposit error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Verify payment and credit wallet
    async verifyPayment(req, res) {
        try {
            const { transaction_id, tx_ref } = req.body;

            if (!transaction_id && !tx_ref) {
                return res.status(400).json(generateResponse(false, 'Transaction ID or reference is required'));
            }

            // Verify payment with Flutterwave
            let verificationResponse;
            if (transaction_id) {
                verificationResponse = await flutterwaveService.verifyTransactionById(transaction_id);
            } else {
                verificationResponse = await flutterwaveService.verifyTransactionByRef(tx_ref);
            }

            if (verificationResponse.status !== 'success') {
                return res.status(400).json(generateResponse(false, verificationResponse.message || 'Payment verification failed'));
            }

            const paymentData = verificationResponse.data;
            const userId = paymentData.meta?.user_id;
            
            if (!userId) {
                return res.status(400).json(generateResponse(false, 'Invalid payment metadata'));
            }

            // Check if payment was successful
            if (paymentData.status !== 'successful') {
                return res.status(400).json(generateResponse(false, 'Payment was not successful'));
            }

            // Check if transaction already processed
            const { data: existingTransaction, error: existingError } = await supabase
                .from('transactions')
                .select('*')
                .eq('payment_reference', paymentData.tx_ref)
                .eq('status', 'completed')
                .single();

            if (existingTransaction) {
                return res.json(generateResponse(true, 'Payment already processed', {
                    transaction: existingTransaction
                }));
            }

            // Get wallet data
            const { data: walletData, error: walletError } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (walletError || !walletData) {
                return res.status(404).json(generateResponse(false, 'Wallet not found'));
            }

            const amount = parseFloat(paymentData.amount);
            const newBalance = parseFloat(walletData.balance) + amount;
            const newTotalDeposits = parseFloat(walletData.total_deposits) + amount;

            // Update wallet balance
            const { error: updateError } = await supabase
                .from('wallets')
                .update({
                    balance: newBalance,
                    total_deposits: newTotalDeposits,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (updateError) {
                console.error('Wallet update error:', updateError);
                return res.status(500).json(generateResponse(false, 'Failed to update wallet balance'));
            }

            // Update transaction status
            const { data: updatedTransaction, error: transactionUpdateError } = await supabase
                .from('transactions')
                .update({
                    status: 'completed',
                    balance_after: newBalance,
                    updated_at: new Date().toISOString(),
                    metadata: {
                        ...paymentData,
                        verified_at: new Date().toISOString()
                    }
                })
                .eq('payment_reference', paymentData.tx_ref)
                .eq('user_id', userId)
                .select()
                .single();

            if (transactionUpdateError) {
                console.error('Transaction update error:', transactionUpdateError);
            }

            // Send real-time update
            realtimeHandler.sendBalanceUpdate(userId, newBalance);

            res.json(generateResponse(true, 'Payment verified and wallet credited successfully', {
                new_balance: newBalance,
                amount_credited: amount,
                transaction: updatedTransaction
            }));

        } catch (error) {
            console.error('Verify payment error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Handle Flutterwave webhook
    async handleWebhook(req, res) {
        try {
            const signature = req.headers['verif-hash'];
            const webhookSecret = process.env.FLUTTERWAVE_WEBHOOK_SECRET;

            // Verify webhook signature
            if (!signature || signature !== webhookSecret) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const payload = req.body;
            
            // Handle successful payment
            if (payload.event === 'charge.completed' && payload.data.status === 'successful') {
                const paymentData = payload.data;
                const userId = paymentData.meta?.user_id;
                
                if (!userId) {
                    console.error('Webhook: Invalid payment metadata');
                    return res.status(200).json({ message: 'Webhook received' });
                }

                // Check if already processed
                const { data: existingTransaction } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('payment_reference', paymentData.tx_ref)
                    .eq('status', 'completed')
                    .single();

                if (existingTransaction) {
                    return res.status(200).json({ message: 'Transaction already processed' });
                }

                // Get wallet data
                const { data: walletData, error: walletError } = await supabase
                    .from('wallets')
                    .select('*')
                    .eq('user_id', userId)
                    .single();

                if (walletError || !walletData) {
                    console.error('Webhook: Wallet not found for user:', userId);
                    return res.status(200).json({ message: 'Webhook received' });
                }

                const amount = parseFloat(paymentData.amount);
                const newBalance = parseFloat(walletData.balance) + amount;
                const newTotalDeposits = parseFloat(walletData.total_deposits) + amount;

                // Update wallet balance
                const { error: updateError } = await supabase
                    .from('wallets')
                    .update({
                        balance: newBalance,
                        total_deposits: newTotalDeposits,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', userId);

                if (updateError) {
                    console.error('Webhook: Wallet update error:', updateError);
                    return res.status(200).json({ message: 'Webhook received' });
                }

                // Update transaction status
                await supabase
                    .from('transactions')
                    .update({
                        status: 'completed',
                        balance_after: newBalance,
                        updated_at: new Date().toISOString(),
                        metadata: {
                            ...paymentData,
                            webhook_processed_at: new Date().toISOString()
                        }
                    })
                    .eq('payment_reference', paymentData.tx_ref)
                    .eq('user_id', userId);

                // Send real-time update
                realtimeHandler.sendBalanceUpdate(userId, newBalance);

                console.log(`Webhook: Successfully processed payment for user ${userId}, amount: ${amount}`);
            }

            res.status(200).json({ message: 'Webhook received' });

        } catch (error) {
            console.error('Webhook error:', error);
            res.status(500).json({ message: 'Webhook processing failed' });
        }
    }

    // Withdraw funds from wallet
    async withdraw(req, res) {
        try {
            const userId = req.user.id;
            const { amount, bank_account, bank_name, account_name } = req.body;

            if (!amount || amount <= 0) {
                return res.status(400).json(generateResponse(false, 'Invalid withdrawal amount'));
            }

            if (!bank_account || !bank_name || !account_name) {
                return res.status(400).json(generateResponse(false, 'Bank details are required'));
            }

            // Get current wallet balance
            const { data: walletData, error: walletError } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (walletError || !walletData) {
                return res.status(404).json(generateResponse(false, 'Wallet not found'));
            }

            const currentBalance = parseFloat(walletData.balance);
            const withdrawalAmount = parseFloat(amount);

            // Check if sufficient balance
            if (currentBalance < withdrawalAmount) {
                return res.status(400).json(generateResponse(false, 'Insufficient wallet balance'));
            }

            // Check minimum withdrawal amount
            const minWithdrawal = parseFloat(process.env.MIN_WITHDRAWAL || '1000');
            if (withdrawalAmount < minWithdrawal) {
                return res.status(400).json(generateResponse(false, `Minimum withdrawal amount is ₦${minWithdrawal}`));
            }

            const newBalance = currentBalance - withdrawalAmount;
            const newTotalWithdrawals = parseFloat(walletData.total_withdrawals) + withdrawalAmount;

            // Update wallet balance
            const { error: updateError } = await supabase
                .from('wallets')
                .update({
                    balance: newBalance,
                    total_withdrawals: newTotalWithdrawals,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (updateError) {
                return res.status(500).json(generateResponse(false, 'Failed to update wallet balance'));
            }

            // Create withdrawal transaction record
            const { data: transactionData, error: transactionError } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'withdrawal',
                    amount: withdrawalAmount,
                    description: `Withdrawal to ${bank_name} - ${account_name}`,
                    status: 'pending',
                    payment_method: 'bank_transfer',
                    payment_reference: `WTH${Date.now()}`,
                    balance_before: currentBalance,
                    balance_after: newBalance,
                    metadata: {
                        bank_account,
                        bank_name,
                        account_name
                    }
                })
                .select()
                .single();

            if (transactionError) {
                console.error('Transaction record error:', transactionError);
            }

            // Send real-time update
            realtimeHandler.sendBalanceUpdate(userId, newBalance);

            res.json(generateResponse(true, 'Withdrawal request submitted successfully', {
                new_balance: newBalance,
                transaction: transactionData,
                message: 'Your withdrawal request is being processed and will be completed within 24 hours'
            }));

        } catch (error) {
            console.error('Withdrawal error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Transfer funds to another user
    async transfer(req, res) {
        try {
            const userId = req.user.id;
            const { recipient_email, amount, description } = req.body;

            if (!recipient_email || !amount || amount <= 0) {
                return res.status(400).json(generateResponse(false, 'Recipient email and valid amount are required'));
            }

            // Check if recipient exists
            const { data: recipientData, error: recipientError } = await supabase
                .from('users')
                .select('id, email, full_name')
                .eq('email', recipient_email)
                .eq('status', 'active')
                .single();

            if (recipientError || !recipientData) {
                return res.status(404).json(generateResponse(false, 'Recipient not found or inactive'));
            }

            if (recipientData.id === userId) {
                return res.status(400).json(generateResponse(false, 'Cannot transfer to yourself'));
            }

            // Get sender wallet
            const { data: senderWallet, error: senderWalletError } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (senderWalletError || !senderWallet) {
                return res.status(404).json(generateResponse(false, 'Sender wallet not found'));
            }

            const currentBalance = parseFloat(senderWallet.balance);
            const transferAmount = parseFloat(amount);

            // Check sufficient balance
            if (currentBalance < transferAmount) {
                return res.status(400).json(generateResponse(false, 'Insufficient wallet balance'));
            }

            // Get recipient wallet
            const { data: recipientWallet, error: recipientWalletError } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', recipientData.id)
                .single();

            if (recipientWalletError || !recipientWallet) {
                return res.status(404).json(generateResponse(false, 'Recipient wallet not found'));
            }

            const senderNewBalance = currentBalance - transferAmount;
            const recipientNewBalance = parseFloat(recipientWallet.balance) + transferAmount;

            // Update sender wallet
            const { error: senderUpdateError } = await supabase
                .from('wallets')
                .update({
                    balance: senderNewBalance,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (senderUpdateError) {
                return res.status(500).json(generateResponse(false, 'Failed to update sender wallet'));
            }

            // Update recipient wallet
            const { error: recipientUpdateError } = await supabase
                .from('wallets')
                .update({
                    balance: recipientNewBalance,
                    total_deposits: parseFloat(recipientWallet.total_deposits) + transferAmount,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', recipientData.id);

            if (recipientUpdateError) {
                // Rollback sender wallet update
                await supabase
                    .from('wallets')
                    .update({
                        balance: currentBalance,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', userId);
                
                return res.status(500).json(generateResponse(false, 'Failed to update recipient wallet'));
            }

            const transferReference = `TFR${Date.now()}`;

            // Create sender transaction
            await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'transfer_out',
                    amount: transferAmount,
                    description: description || `Transfer to ${recipientData.full_name}`,
                    status: 'completed',
                    payment_reference: transferReference,
                    balance_before: currentBalance,
                    balance_after: senderNewBalance,
                    metadata: {
                        recipient_id: recipientData.id,
                        recipient_email: recipientData.email
                    }
                });

            // Create recipient transaction
            await supabase
                .from('transactions')
                .insert({
                    user_id: recipientData.id,
                    type: 'transfer_in',
                    amount: transferAmount,
                    description: description || `Transfer from ${req.user.full_name}`,
                    status: 'completed',
                    payment_reference: transferReference,
                    balance_before: parseFloat(recipientWallet.balance),
                    balance_after: recipientNewBalance,
                    metadata: {
                        sender_id: userId,
                        sender_email: req.user.email
                    }
                });

            // Send real-time updates
            realtimeHandler.sendBalanceUpdate(userId, senderNewBalance);
            realtimeHandler.sendBalanceUpdate(recipientData.id, recipientNewBalance);

            res.json(generateResponse(true, 'Transfer completed successfully', {
                new_balance: senderNewBalance,
                recipient: recipientData.full_name,
                amount: transferAmount,
                reference: transferReference
            }));

        } catch (error) {
            console.error('Transfer error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get wallet transaction history
    async getTransactionHistory(req, res) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 20, type, start_date, end_date } = req.query;

            console.log('📋 Getting wallet transaction history:', userId);

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                type,
                startDate: start_date,
                endDate: end_date
            };

            const result = await walletService.getTransactionHistory(userId, options);

            res.json(generateResponse(true, 'Transaction history retrieved successfully', result.transactions, {
                pagination: result.pagination
            }));

        } catch (error) {
            console.error('Get transaction history error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get wallet statistics
    async getWalletStats(req, res) {
        try {
            const userId = req.user.id;
            const { period = 30 } = req.query;

            console.log('📈 Getting wallet statistics:', userId);

            const stats = await walletService.getWalletStats(userId, parseInt(period));

            res.json(generateResponse(true, 'Wallet statistics retrieved successfully', stats));

        } catch (error) {
            console.error('Get wallet stats error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Debit wallet for VTU purchases (called by VTU service)
    async debitWalletForPurchase(userId, amount, description, reference) {
        try {
            console.log('💳 Debiting wallet for purchase:', { userId, amount, description, reference });

            // Use wallet service to debit wallet
            const result = await walletService.debitWallet(userId, amount, description, reference);

            console.log('✅ Wallet debited successfully:', result.new_balance);
            return result;

        } catch (error) {
            console.error('❌ Failed to debit wallet:', error);
            throw error;
        }
    }

    // Credit wallet for refunds (called by VTU service)
    async creditWalletForRefund(userId, amount, description, reference) {
        try {
            console.log('💵 Crediting wallet for refund:', { userId, amount, description, reference });

            // Use wallet service to credit wallet
            const result = await walletService.creditWallet(userId, amount, description, reference);

            console.log('✅ Wallet credited successfully:', result.new_balance);
            return result;

        } catch (error) {
            console.error('❌ Failed to credit wallet:', error);
            throw error;
        }
    }
}

module.exports = new WalletController();
