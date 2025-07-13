const axios = require('axios');

class VTUService {
    constructor() {
        this.baseURL = process.env.VTU_PROVIDER_URL || 'https://api.vtuprovider.com';
        this.apiKey = process.env.VTU_API_KEY || 'default_vtu_key';
        this.secretKey = process.env.VTU_SECRET_KEY || 'default_vtu_secret';
        
        this.axiosInstance = axios.create({
            baseURL: this.baseURL,
            timeout: 30000, // 30 seconds timeout
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'X-Secret-Key': this.secretKey
            }
        });
    }

    // Get available networks for airtime
    async getAvailableNetworks() {
        try {
            // In a real implementation, this would call the VTU provider API
            // For now, returning mock data with common Nigerian networks
            return [
                {
                    id: 'mtn',
                    name: 'MTN',
                    code: '001',
                    status: 'active',
                    discount: 2.5 // percentage discount for resellers
                },
                {
                    id: 'glo',
                    name: 'Globacom',
                    code: '002',
                    status: 'active',
                    discount: 3.0
                },
                {
                    id: 'airtel',
                    name: 'Airtel',
                    code: '003',
                    status: 'active',
                    discount: 2.0
                },
                {
                    id: '9mobile',
                    name: '9mobile',
                    code: '004',
                    status: 'active',
                    discount: 3.5
                }
            ];
        } catch (error) {
            console.error('Get networks error:', error);
            throw new Error('Failed to retrieve networks');
        }
    }

    // Get data plans for a specific network
    async getDataPlans(network) {
        try {
            // Mock data plans for different networks
            const dataPlans = {
                mtn: [
                    { id: 'mtn_1gb_30d', name: '1GB - 30 Days', price: 245, data: '1GB', validity: '30 days' },
                    { id: 'mtn_2gb_30d', name: '2GB - 30 Days', price: 490, data: '2GB', validity: '30 days' },
                    { id: 'mtn_5gb_30d', name: '5GB - 30 Days', price: 1225, data: '5GB', validity: '30 days' },
                    { id: 'mtn_10gb_30d', name: '10GB - 30 Days', price: 2450, data: '10GB', validity: '30 days' }
                ],
                glo: [
                    { id: 'glo_1gb_30d', name: '1GB - 30 Days', price: 240, data: '1GB', validity: '30 days' },
                    { id: 'glo_2gb_30d', name: '2GB - 30 Days', price: 480, data: '2GB', validity: '30 days' },
                    { id: 'glo_5gb_30d', name: '5GB - 30 Days', price: 1200, data: '5GB', validity: '30 days' },
                    { id: 'glo_10gb_30d', name: '10GB - 30 Days', price: 2400, data: '10GB', validity: '30 days' }
                ],
                airtel: [
                    { id: 'airtel_1gb_30d', name: '1GB - 30 Days', price: 250, data: '1GB', validity: '30 days' },
                    { id: 'airtel_2gb_30d', name: '2GB - 30 Days', price: 500, data: '2GB', validity: '30 days' },
                    { id: 'airtel_5gb_30d', name: '5GB - 30 Days', price: 1250, data: '5GB', validity: '30 days' },
                    { id: 'airtel_10gb_30d', name: '10GB - 30 Days', price: 2500, data: '10GB', validity: '30 days' }
                ],
                '9mobile': [
                    { id: '9mobile_1gb_30d', name: '1GB - 30 Days', price: 260, data: '1GB', validity: '30 days' },
                    { id: '9mobile_2gb_30d', name: '2GB - 30 Days', price: 520, data: '2GB', validity: '30 days' },
                    { id: '9mobile_5gb_30d', name: '5GB - 30 Days', price: 1300, data: '5GB', validity: '30 days' },
                    { id: '9mobile_10gb_30d', name: '10GB - 30 Days', price: 2600, data: '10GB', validity: '30 days' }
                ]
            };

            return dataPlans[network] || [];
        } catch (error) {
            console.error('Get data plans error:', error);
            throw new Error('Failed to retrieve data plans');
        }
    }

    // Purchase airtime
    async purchaseAirtime({ network, phone_number, amount }) {
        try {
            // In a real implementation, this would call the VTU provider API
            const requestData = {
                service: 'airtime',
                network,
                phone: phone_number,
                amount: parseFloat(amount),
                reference: `STK_AIRTIME_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
            };

            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Simulate success/failure (90% success rate)
            const isSuccess = Math.random() > 0.1;

            if (isSuccess) {
                return {
                    success: true,
                    reference: requestData.reference,
                    message: 'Airtime purchase successful',
                    balance: amount,
                    phone_number,
                    network
                };
            } else {
                return {
                    success: false,
                    message: 'Airtime purchase failed. Please try again later.',
                    error_code: 'VTU_FAILED'
                };
            }

        } catch (error) {
            console.error('Purchase airtime error:', error);
            return {
                success: false,
                message: 'VTU service temporarily unavailable',
                error_code: 'VTU_UNAVAILABLE'
            };
        }
    }

    // Purchase data
    async purchaseData({ network, phone_number, plan_id, amount }) {
        try {
            const requestData = {
                service: 'data',
                network,
                phone: phone_number,
                plan_id,
                amount: parseFloat(amount),
                reference: `STK_DATA_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
            };

            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 2500));

            // Simulate success/failure (90% success rate)
            const isSuccess = Math.random() > 0.1;

            if (isSuccess) {
                return {
                    success: true,
                    reference: requestData.reference,
                    message: 'Data purchase successful',
                    plan_id,
                    phone_number,
                    network
                };
            } else {
                return {
                    success: false,
                    message: 'Data purchase failed. Please try again later.',
                    error_code: 'VTU_FAILED'
                };
            }

        } catch (error) {
            console.error('Purchase data error:', error);
            return {
                success: false,
                message: 'VTU service temporarily unavailable',
                error_code: 'VTU_UNAVAILABLE'
            };
        }
    }

    // Get cable TV providers
    async getCableProviders() {
        try {
            return [
                {
                    id: 'dstv',
                    name: 'DSTV',
                    code: 'DSTV',
                    status: 'active'
                },
                {
                    id: 'gotv',
                    name: 'GOtv',
                    code: 'GOTV',
                    status: 'active'
                },
                {
                    id: 'startimes',
                    name: 'StarTimes',
                    code: 'STAR',
                    status: 'active'
                }
            ];
        } catch (error) {
            console.error('Get cable providers error:', error);
            throw new Error('Failed to retrieve cable providers');
        }
    }

    // Get cable TV packages
    async getCablePackages(provider) {
        try {
            const packages = {
                dstv: [
                    { id: 'dstv_access', name: 'DStv Access', price: 2150, duration: '30 days' },
                    { id: 'dstv_family', name: 'DStv Family', price: 4000, duration: '30 days' },
                    { id: 'dstv_compact', name: 'DStv Compact', price: 6800, duration: '30 days' },
                    { id: 'dstv_compact_plus', name: 'DStv Compact Plus', price: 11500, duration: '30 days' },
                    { id: 'dstv_premium', name: 'DStv Premium', price: 18400, duration: '30 days' }
                ],
                gotv: [
                    { id: 'gotv_smallie', name: 'GOtv Smallie', price: 900, duration: '30 days' },
                    { id: 'gotv_jinja', name: 'GOtv Jinja', price: 1900, duration: '30 days' },
                    { id: 'gotv_jolli', name: 'GOtv Jolli', price: 2800, duration: '30 days' },
                    { id: 'gotv_max', name: 'GOtv Max', price: 4150, duration: '30 days' }
                ],
                startimes: [
                    { id: 'star_nova', name: 'Nova Bouquet', price: 900, duration: '30 days' },
                    { id: 'star_basic', name: 'Basic Bouquet', price: 1600, duration: '30 days' },
                    { id: 'star_smart', name: 'Smart Bouquet', price: 2500, duration: '30 days' },
                    { id: 'star_classic', name: 'Classic Bouquet', price: 2700, duration: '30 days' },
                    { id: 'star_super', name: 'Super Bouquet', price: 4200, duration: '30 days' }
                ]
            };

            return packages[provider] || [];
        } catch (error) {
            console.error('Get cable packages error:', error);
            throw new Error('Failed to retrieve cable packages');
        }
    }

    // Purchase cable TV subscription
    async purchaseCable({ provider, package_id, smartcard_number, amount }) {
        try {
            const requestData = {
                service: 'cable',
                provider,
                package_id,
                smartcard: smartcard_number,
                amount: parseFloat(amount),
                reference: `STK_CABLE_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
            };

            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Simulate success/failure (88% success rate)
            const isSuccess = Math.random() > 0.12;

            if (isSuccess) {
                return {
                    success: true,
                    reference: requestData.reference,
                    message: 'Cable subscription successful',
                    provider,
                    package_id,
                    smartcard_number
                };
            } else {
                return {
                    success: false,
                    message: 'Cable subscription failed. Please verify smartcard number and try again.',
                    error_code: 'INVALID_SMARTCARD'
                };
            }

        } catch (error) {
            console.error('Purchase cable error:', error);
            return {
                success: false,
                message: 'Cable service temporarily unavailable',
                error_code: 'CABLE_UNAVAILABLE'
            };
        }
    }

    // Get electricity providers
    async getElectricityProviders() {
        try {
            return [
                { id: 'eko_electric', name: 'Eko Electricity Distribution Company', code: 'EKEDC', status: 'active' },
                { id: 'ikeja_electric', name: 'Ikeja Electric', code: 'IKEDC', status: 'active' },
                { id: 'abuja_electric', name: 'Abuja Electricity Distribution Company', code: 'AEDC', status: 'active' },
                { id: 'kano_electric', name: 'Kano Electricity Distribution Company', code: 'KEDCO', status: 'active' },
                { id: 'port_harcourt_electric', name: 'Port Harcourt Electricity Distribution Company', code: 'PHEDC', status: 'active' },
                { id: 'jos_electric', name: 'Jos Electricity Distribution Company', code: 'JEDC', status: 'active' },
                { id: 'kaduna_electric', name: 'Kaduna Electric', code: 'KAEDCO', status: 'active' },
                { id: 'benin_electric', name: 'Benin Electricity Distribution Company', code: 'BEDC', status: 'active' },
                { id: 'enugu_electric', name: 'Enugu Electricity Distribution Company', code: 'EEDC', status: 'active' },
                { id: 'ibadan_electric', name: 'Ibadan Electricity Distribution Company', code: 'IBEDC', status: 'active' }
            ];
        } catch (error) {
            console.error('Get electricity providers error:', error);
            throw new Error('Failed to retrieve electricity providers');
        }
    }

    // Purchase electricity token
    async purchaseElectricity({ provider, meter_number, meter_type, amount, customer_name }) {
        try {
            const requestData = {
                service: 'electricity',
                provider,
                meter_number,
                meter_type,
                customer_name,
                amount: parseFloat(amount),
                reference: `STK_ELECTRIC_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
            };

            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 4000));

            // Simulate success/failure (85% success rate)
            const isSuccess = Math.random() > 0.15;

            if (isSuccess) {
                // Generate a mock electricity token
                const token = Math.random().toString().substr(2, 20).match(/.{1,4}/g).join('-');
                
                return {
                    success: true,
                    reference: requestData.reference,
                    message: 'Electricity purchase successful',
                    token,
                    units: (parseFloat(amount) / 65).toFixed(2), // Rough calculation of units
                    meter_number,
                    customer_name: customer_name || 'N/A',
                    provider
                };
            } else {
                return {
                    success: false,
                    message: 'Electricity purchase failed. Please verify meter number and try again.',
                    error_code: 'INVALID_METER'
                };
            }

        } catch (error) {
            console.error('Purchase electricity error:', error);
            return {
                success: false,
                message: 'Electricity service temporarily unavailable',
                error_code: 'ELECTRICITY_UNAVAILABLE'
            };
        }
    }

    // Verify meter number
    async verifyMeterNumber(provider, meter_number, meter_type) {
        try {
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Simulate verification (80% success rate)
            const isValid = Math.random() > 0.2;

            if (isValid) {
                return {
                    success: true,
                    customer_name: `Customer ${Math.random().toString(36).substr(2, 8)}`,
                    customer_address: 'Sample Address, Lagos, Nigeria',
                    meter_type: meter_type,
                    meter_number
                };
            } else {
                return {
                    success: false,
                    message: 'Invalid meter number or meter not found'
                };
            }

        } catch (error) {
            console.error('Verify meter error:', error);
            return {
                success: false,
                message: 'Verification service temporarily unavailable'
            };
        }
    }

    // Check service status
    async checkServiceStatus() {
        try {
            return {
                airtime: 'online',
                data: 'online',
                cable: 'online',
                electricity: 'online',
                last_checked: new Date().toISOString()
            };
        } catch (error) {
            console.error('Check service status error:', error);
            return {
                airtime: 'offline',
                data: 'offline',
                cable: 'offline',
                electricity: 'offline',
                last_checked: new Date().toISOString()
            };
        }
    }

    // Get transaction status
    async getTransactionStatus(reference) {
        try {
            // In a real implementation, this would query the VTU provider for transaction status
            return {
                reference,
                status: 'completed',
                message: 'Transaction completed successfully',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Get transaction status error:', error);
            return {
                reference,
                status: 'unknown',
                message: 'Unable to determine transaction status',
                timestamp: new Date().toISOString()
            };
        }
    }
}

const vtuService = new VTUService();
module.exports = { vtuService };
