const axios = require('axios');
const crypto = require('crypto');

class FlutterwaveService {
    constructor() {
        this.secretKey = process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLW_SECRET_KEY;
        this.publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY || process.env.FLW_PUBLIC_KEY;
        this.encryptionKey = process.env.FLUTTERWAVE_ENCRYPTION_KEY || process.env.FLW_ENCRYPTION_KEY;
        this.webhookSecret = process.env.FLUTTERWAVE_WEBHOOK_SECRET || process.env.FLW_WEBHOOK_SECRET;
        this.baseURL = 'https://api.flutterwave.com/v3';
        
        if (!this.secretKey) {
            console.error('⚠️ FLUTTERWAVE_SECRET_KEY not found in environment variables');
        }
        if (!this.publicKey) {
            console.error('⚠️ FLUTTERWAVE_PUBLIC_KEY not found in environment variables');
        }
    }

    /**
     * Verify Flutterwave transaction by transaction ID
     * @param {string|number} transactionId - Flutterwave transaction ID
     * @returns {Promise<Object>} Verification result
     */
    async verifyTransactionById(transactionId) {
        try {
            console.log('🔍 Verifying Flutterwave transaction:', transactionId);

            if (!this.secretKey) {
                throw new Error('Flutterwave secret key not configured');
            }

            const response = await axios.get(
                `${this.baseURL}/transactions/${transactionId}/verify`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.secretKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const { data } = response.data;

            if (data && data.status === 'successful') {
                console.log('✅ Flutterwave transaction verified successfully:', data.tx_ref);
                return {
                    status: 'success',
                    message: 'Transaction verified successfully',
                    data: data
                };
            } else {
                console.log('❌ Flutterwave transaction verification failed:', data?.status || 'Unknown status');
                return {
                    status: 'failed',
                    message: `Transaction verification failed: ${data?.processor_response || 'Unknown error'}`,
                    data: data
                };
            }

        } catch (error) {
            console.error('❌ Flutterwave verification error:', error.message);
            
            if (error.response) {
                console.error('❌ Error response:', error.response.data);
                return {
                    status: 'error',
                    message: error.response.data?.message || 'Verification request failed',
                    data: null
                };
            }
            
            return {
                status: 'error',
                message: error.message || 'Network error during verification',
                data: null
            };
        }
    }

    /**
     * Verify Flutterwave transaction by transaction reference
     * @param {string} txRef - Transaction reference
     * @returns {Promise<Object>} Verification result
     */
    async verifyTransactionByRef(txRef) {
        try {
            console.log('🔍 Verifying Flutterwave transaction by ref:', txRef);

            if (!this.secretKey) {
                throw new Error('Flutterwave secret key not configured');
            }

            const response = await axios.get(
                `${this.baseURL}/transactions/verify_by_reference?tx_ref=${txRef}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.secretKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const { data } = response.data;

            if (data && data.status === 'successful') {
                console.log('✅ Flutterwave transaction verified by ref:', txRef);
                return {
                    status: 'success',
                    message: 'Transaction verified successfully',
                    data: data
                };
            } else {
                console.log('❌ Flutterwave transaction verification by ref failed:', data?.status || 'Unknown status');
                return {
                    status: 'failed',
                    message: `Transaction verification failed: ${data?.processor_response || 'Unknown error'}`,
                    data: data
                };
            }

        } catch (error) {
            console.error('❌ Flutterwave verification by ref error:', error.message);
            
            if (error.response) {
                console.error('❌ Error response:', error.response.data);
                return {
                    status: 'error',
                    message: error.response.data?.message || 'Verification request failed',
                    data: null
                };
            }
            
            return {
                status: 'error',
                message: error.message || 'Network error during verification',
                data: null
            };
        }
    }

    /**
     * Generate unique transaction reference
     * @param {string} userId - User ID to include in reference
     * @returns {string} Unique transaction reference
     */
    generateTxRef(userId = '') {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        const userPart = userId ? `_${userId}` : '';
        return `starktol${userPart}_${timestamp}_${random}`;
    }

    /**
     * Create Flutterwave payment link
     * @param {Object} paymentData - Payment configuration
     * @returns {Promise<Object>} Payment link result
     */
    async createPaymentLink(paymentData) {
        try {
            const {
                amount,
                userId,
                userEmail,
                userName,
                userPhone,
                description = 'Wallet funding',
                redirectUrl
            } = paymentData;

            if (!this.secretKey) {
                throw new Error('Flutterwave secret key not configured');
            }

            const txRef = this.generateTxRef(userId);

            const payload = {
                tx_ref: txRef,
                amount: parseFloat(amount),
                currency: 'NGN',
                redirect_url: redirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:8000'}/dashboard/wallet/fund/success`,
                payment_options: 'card,banktransfer,ussd,account,mobilemoney,barter,qr',
                customer: {
                    email: userEmail,
                    phone_number: userPhone || '',
                    name: userName || 'Customer'
                },
                customizations: {
                    title: 'StarkTol VTU - Wallet Funding',
                    description: description,
                    logo: `${process.env.FRONTEND_URL || 'http://localhost:8000'}/logo.png`
                },
                meta: {
                    source: 'wallet_funding',
                    platform: 'web',
                    user_id: userId
                }
            };

            console.log('🚀 Creating Flutterwave payment link:', { ...payload, customer: { ...payload.customer, email: '[HIDDEN]' } });

            const response = await axios.post(
                `${this.baseURL}/payments`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.secretKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.status === 'success') {
                console.log('✅ Payment link created successfully:', txRef);
                return {
                    success: true,
                    paymentLink: response.data.data.link,
                    txRef: txRef,
                    data: response.data.data
                };
            } else {
                throw new Error(response.data.message || 'Failed to create payment link');
            }

        } catch (error) {
            console.error('❌ Payment link creation failed:', error.message);
            
            if (error.response) {
                console.error('❌ Error response:', error.response.data);
                throw new Error(error.response.data?.message || 'Payment link creation failed');
            }
            
            throw error;
        }
    }

    /**
     * Verify webhook signature
     * @param {string} signature - Webhook signature from headers
     * @param {Object} payload - Webhook payload
     * @returns {boolean} Whether signature is valid
     */
    verifyWebhookSignature(signature, payload) {
        try {
            if (!this.webhookSecret) {
                console.warn('⚠️ Webhook secret not configured, skipping signature verification');
                return true; // Allow webhook if secret not configured (for development)
            }

            const hash = crypto
                .createHmac('sha256', this.webhookSecret)
                .update(JSON.stringify(payload))
                .digest('hex');

            return signature === hash;
        } catch (error) {
            console.error('❌ Webhook signature verification error:', error);
            return false;
        }
    }

    /**
     * Process webhook event
     * @param {Object} event - Webhook event data
     * @returns {Object} Processing result
     */
    async processWebhookEvent(event) {
        try {
            console.log('📥 Processing Flutterwave webhook:', event.event);

            if (event.event === 'charge.completed' && event.data.status === 'successful') {
                const transactionData = event.data;
                
                // Verify the transaction with Flutterwave
                const verification = await this.verifyTransactionById(transactionData.id);
                
                if (verification.status === 'success') {
                    return {
                        success: true,
                        action: 'credit_wallet',
                        data: {
                            txRef: transactionData.tx_ref,
                            amount: transactionData.amount,
                            userId: transactionData.meta?.user_id,
                            flwRef: transactionData.flw_ref,
                            customer: transactionData.customer
                        }
                    };
                } else {
                    console.log('❌ Webhook transaction verification failed:', transactionData.tx_ref);
                    return {
                        success: false,
                        message: 'Transaction verification failed'
                    };
                }
            }

            console.log('ℹ️ Webhook event not processed:', event.event);
            return {
                success: true,
                message: 'Event acknowledged but not processed'
            };

        } catch (error) {
            console.error('❌ Webhook processing error:', error);
            return {
                success: false,
                message: error.message || 'Webhook processing failed'
            };
        }
    }
}

// Create singleton instance
const flutterwaveService = new FlutterwaveService();

// Legacy function for backward compatibility
async function verifyFlutterwaveTransaction(transactionRef) {
    return await flutterwaveService.verifyTransactionById(transactionRef);
}

module.exports = {
    FlutterwaveService,
    flutterwaveService,
    verifyFlutterwaveTransaction
};
