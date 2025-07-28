const axios = require('axios');
const crypto = require('crypto');

class PaymentService {
    constructor() {
        // Flutterwave API configuration
        this.baseURL = process.env.FLUTTERWAVE_BASE_URL || 'https://api.flutterwave.com/v3';
        this.secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
        this.publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY;
        this.encryptionKey = process.env.FLUTTERWAVE_ENCRYPTION_KEY;
        
        if (!this.secretKey || !this.publicKey) {
            console.warn('⚠️ Flutterwave credentials not found in environment variables. Payment services may not work properly.');
        }
        
        this.axiosInstance = axios.create({
            baseURL: this.baseURL,
            timeout: 30000, // 30 seconds timeout
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.secretKey}`
            }
        });
    }
    
    // Generate secure payment reference
    generatePaymentReference(prefix = 'STK_PAY') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    }
    
    // Initialize payment with Flutterwave
    async initializePayment({
        amount,
        email,
        phone_number,
        name,
        redirect_url,
        webhook_url,
        metadata = {}
    }) {
        try {
            const tx_ref = this.generatePaymentReference();
            
            const payload = {
                tx_ref,
                amount: parseFloat(amount),
                currency: 'NGN',
                redirect_url: redirect_url || `${process.env.FRONTEND_URL}/dashboard/wallet/fund/callback`,
                payment_options: 'card,banktransfer,ussd',
                customer: {
                    email,
                    phonenumber: phone_number,
                    name
                },
                customizations: {
                    title: 'StarkTol VTU Platform',
                    description: 'Wallet Funding',
                    logo: `${process.env.FRONTEND_URL}/logo.png`
                },
                meta: {
                    ...metadata,
                    source: 'starktol_wallet_funding'
                }
            };
            
            console.log('🔄 Flutterwave Payment Request:', { ...payload, customer: { ...payload.customer, email: '***' } });
            
            const response = await this.axiosInstance.post('/payments', payload);
            
            console.log('📡 Flutterwave Payment Response:', {
                status: response.data.status,
                message: response.data.message,
                data: response.data.data ? { link: response.data.data.link } : null
            });
            
            if (response.data.status === 'success') {
                return {
                    success: true,
                    reference: tx_ref,
                    payment_link: response.data.data.link,
                    message: 'Payment initialized successfully',
                    data: response.data.data
                };
            } else {
                return {
                    success: false,
                    message: response.data.message || 'Payment initialization failed',
                    error_code: 'PAYMENT_INIT_FAILED'
                };
            }
            
        } catch (error) {
            console.error('Payment initialization error:', error);
            
            if (error.response) {
                const errorData = error.response.data;
                return {
                    success: false,
                    message: errorData.message || 'Payment initialization failed',
                    error_code: errorData.code || 'API_ERROR'
                };
            }
            
            return {
                success: false,
                message: 'Payment service temporarily unavailable',
                error_code: 'NETWORK_ERROR'
            };
        }
    }
    
    // Verify payment status
    async verifyPayment(transaction_id) {
        try {
            console.log('🔍 Verifying payment:', transaction_id);
            
            const response = await this.axiosInstance.get(`/transactions/${transaction_id}/verify`);
            
            console.log('✅ Payment verification response:', {
                status: response.data.status,
                transaction_status: response.data.data?.status,
                amount: response.data.data?.amount,
                currency: response.data.data?.currency
            });
            
            if (response.data.status === 'success') {
                const transactionData = response.data.data;
                
                return {
                    success: true,
                    status: transactionData.status,
                    amount: transactionData.amount,
                    currency: transactionData.currency,
                    reference: transactionData.tx_ref,
                    flw_ref: transactionData.flw_ref,
                    customer: transactionData.customer,
                    payment_type: transactionData.payment_type,
                    transaction_data: transactionData
                };
            } else {
                return {
                    success: false,
                    message: response.data.message || 'Payment verification failed',
                    error_code: 'VERIFICATION_FAILED'
                };
            }
            
        } catch (error) {
            console.error('Payment verification error:', error);
            
            if (error.response) {
                const errorData = error.response.data;
                return {
                    success: false,
                    message: errorData.message || 'Payment verification failed',
                    error_code: errorData.code || 'API_ERROR'
                };
            }
            
            return {
                success: false,
                message: 'Payment verification service temporarily unavailable',
                error_code: 'NETWORK_ERROR'
            };
        }
    }
    
    // Verify webhook signature for security
    verifyWebhookSignature(signature, payload) {
        try {
            if (!this.secretKey) {
                console.warn('⚠️ Cannot verify webhook signature: Secret key not configured');
                return false;
            }
            
            const hash = crypto.createHmac('sha256', this.secretKey)
                .update(JSON.stringify(payload))
                .digest('hex');
                
            return hash === signature;
        } catch (error) {
            console.error('Webhook signature verification error:', error);
            return false;
        }
    }
    
    // Process webhook from Flutterwave
    async processWebhook(signature, payload) {
        try {
            // Verify webhook signature for security
            if (!this.verifyWebhookSignature(signature, payload)) {
                return {
                    success: false,
                    message: 'Invalid webhook signature',
                    error_code: 'INVALID_SIGNATURE'
                };
            }
            
            const { event, data } = payload;
            
            console.log('📨 Processing Flutterwave webhook:', {
                event,
                tx_ref: data?.tx_ref,
                status: data?.status,
                amount: data?.amount
            });
            
            if (event === 'charge.completed') {
                if (data.status === 'successful') {
                    return {
                        success: true,
                        event: 'payment_successful',
                        reference: data.tx_ref,
                        amount: data.amount,
                        currency: data.currency,
                        customer: data.customer,
                        flw_ref: data.flw_ref,
                        transaction_data: data
                    };
                } else {
                    return {
                        success: true,
                        event: 'payment_failed',
                        reference: data.tx_ref,
                        message: 'Payment was not successful',
                        transaction_data: data
                    };
                }
            }
            
            return {
                success: true,
                event: 'webhook_received',
                message: 'Webhook processed but no action taken'
            };
            
        } catch (error) {
            console.error('Webhook processing error:', error);
            return {
                success: false,
                message: 'Webhook processing failed',
                error_code: 'WEBHOOK_ERROR'
            };
        }
    }
    
    // Get transaction history from Flutterwave
    async getTransactionHistory(from, to, page = 1, per_page = 20) {
        try {
            const params = {
                from,
                to,
                page,
                per_page
            };
            
            const response = await this.axiosInstance.get('/transactions', { params });
            
            if (response.data.status === 'success') {
                return {
                    success: true,
                    transactions: response.data.data,
                    meta: response.data.meta
                };
            } else {
                return {
                    success: false,
                    message: response.data.message || 'Failed to fetch transaction history',
                    error_code: 'HISTORY_FETCH_FAILED'
                };
            }
            
        } catch (error) {
            console.error('Transaction history error:', error);
            return {
                success: false,
                message: 'Failed to fetch transaction history',
                error_code: 'NETWORK_ERROR'
            };
        }
    }
    
    // Get supported banks for bank transfer
    async getSupportedBanks() {
        try {
            const response = await this.axiosInstance.get('/banks/NG');
            
            if (response.data.status === 'success') {
                return {
                    success: true,
                    banks: response.data.data
                };
            } else {
                return {
                    success: false,
                    message: response.data.message || 'Failed to fetch banks',
                    error_code: 'BANKS_FETCH_FAILED'
                };
            }
            
        } catch (error) {
            console.error('Banks fetch error:', error);
            return {
                success: false,
                message: 'Failed to fetch supported banks',
                error_code: 'NETWORK_ERROR'
            };
        }
    }
    
    // Refund payment (if needed)
    async refundPayment(transaction_id, amount, reason = 'Customer request') {
        try {
            const payload = {
                amount: parseFloat(amount),
                comments: reason
            };
            
            const response = await this.axiosInstance.post(`/transactions/${transaction_id}/refund`, payload);
            
            if (response.data.status === 'success') {
                return {
                    success: true,
                    refund_data: response.data.data,
                    message: 'Refund processed successfully'
                };
            } else {
                return {
                    success: false,
                    message: response.data.message || 'Refund failed',
                    error_code: 'REFUND_FAILED'
                };
            }
            
        } catch (error) {
            console.error('Refund error:', error);
            return {
                success: false,
                message: 'Refund processing failed',
                error_code: 'NETWORK_ERROR'
            };
        }
    }
}

const paymentService = new PaymentService();
module.exports = { paymentService };
