const { supabase } = require('../config/supabase');
const { generateResponse } = require('../utils/helpers');
const { vtuService } = require('../services/vtuService');
const { realtimeHandler } = require('../utils/realtimeHandler');

class VTUController {
    // Get available networks for airtime
    async getNetworks(req, res) {
        try {
            const networks = await vtuService.getAvailableNetworks();
            res.json(generateResponse(true, 'Networks retrieved successfully', networks));
        } catch (error) {
            console.error('Get networks error:', error);
            res.status(500).json(generateResponse(false, 'Failed to retrieve networks'));
        }
    }

    // Get data plans for a specific network
    async getDataPlans(req, res) {
        try {
            const { network } = req.params;
            
            if (!network) {
                return res.status(400).json(generateResponse(false, 'Network parameter is required'));
            }

            const dataPlans = await vtuService.getDataPlans(network);
            res.json(generateResponse(true, 'Data plans retrieved successfully', dataPlans));
        } catch (error) {
            console.error('Get data plans error:', error);
            res.status(500).json(generateResponse(false, 'Failed to retrieve data plans'));
        }
    }

    // Purchase airtime
    async purchaseAirtime(req, res) {
        try {
            const userId = req.user.id;
            const { network, phone_number, amount } = req.body;

            // Validate input
            if (!network || !phone_number || !amount) {
                return res.status(400).json(generateResponse(false, 'Network, phone number, and amount are required'));
            }

            if (amount < 50 || amount > 10000) {
                return res.status(400).json(generateResponse(false, 'Amount must be between ₦50 and ₦10,000'));
            }

            // Validate phone number format
            const phoneRegex = /^(\+234|234|0)[789]\d{9}$/;
            if (!phoneRegex.test(phone_number)) {
                return res.status(400).json(generateResponse(false, 'Invalid phone number format'));
            }

            // Check wallet balance
            const { data: walletData, error: walletError } = await supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', userId)
                .single();

            if (walletError || !walletData) {
                return res.status(404).json(generateResponse(false, 'Wallet not found'));
            }

            const currentBalance = parseFloat(walletData.balance);
            const purchaseAmount = parseFloat(amount);

            if (currentBalance < purchaseAmount) {
                return res.status(400).json(generateResponse(false, 'Insufficient wallet balance'));
            }

            // Calculate reseller discount if applicable
            let discountedAmount = purchaseAmount;
            if (req.user.role === 'reseller' || req.user.role === 'sub_reseller') {
                const { data: resellerData } = await supabase
                    .from('resellers')
                    .select('airtime_discount')
                    .eq('user_id', userId)
                    .single();

                if (resellerData && resellerData.airtime_discount) {
                    const discount = parseFloat(resellerData.airtime_discount);
                    discountedAmount = purchaseAmount * (1 - discount / 100);
                }
            }

            const newBalance = currentBalance - discountedAmount;

            // Create transaction record first
            const { data: transactionData, error: transactionError } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'airtime_purchase',
                    amount: discountedAmount,
                    description: `${network} airtime purchase for ${phone_number}`,
                    status: 'processing',
                    balance_before: currentBalance,
                    balance_after: newBalance,
                    metadata: {
                        network,
                        phone_number,
                        airtime_amount: purchaseAmount,
                        service_type: 'airtime'
                    }
                })
                .select()
                .single();

            if (transactionError) {
                return res.status(500).json(generateResponse(false, 'Failed to create transaction record'));
            }

            try {
                // Process airtime purchase with VTU service
                const vtuResult = await vtuService.purchaseAirtime({
                    network,
                    phone_number,
                    amount: purchaseAmount
                });

                if (vtuResult.success) {
                    // Update wallet balance
                    await supabase
                        .from('wallets')
                        .update({
                            balance: newBalance,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', userId);

                    // Update transaction status
                    await supabase
                        .from('transactions')
                        .update({
                            status: 'completed',
                            payment_reference: vtuResult.reference,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', transactionData.id);

                    // Send real-time balance update
                    realtimeHandler.sendBalanceUpdate(userId, newBalance);

                    res.json(generateResponse(true, 'Airtime purchase successful', {
                        transaction: {
                            ...transactionData,
                            status: 'completed',
                            payment_reference: vtuResult.reference
                        },
                        new_balance: newBalance,
                        vtu_reference: vtuResult.reference
                    }));

                } else {
                    // Update transaction status to failed
                    await supabase
                        .from('transactions')
                        .update({
                            status: 'failed',
                            error_message: vtuResult.message,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', transactionData.id);

                    res.status(400).json(generateResponse(false, vtuResult.message || 'Airtime purchase failed'));
                }

            } catch (vtuError) {
                console.error('VTU service error:', vtuError);

                // Update transaction status to failed
                await supabase
                    .from('transactions')
                    .update({
                        status: 'failed',
                        error_message: vtuError.message,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', transactionData.id);

                res.status(500).json(generateResponse(false, 'VTU service temporarily unavailable'));
            }

        } catch (error) {
            console.error('Purchase airtime error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Purchase data
    async purchaseData(req, res) {
        try {
            const userId = req.user.id;
            const { network, phone_number, plan_id, amount } = req.body;

            // Validate input
            if (!network || !phone_number || !plan_id || !amount) {
                return res.status(400).json(generateResponse(false, 'All fields are required'));
            }

            // Validate phone number format
            const phoneRegex = /^(\+234|234|0)[789]\d{9}$/;
            if (!phoneRegex.test(phone_number)) {
                return res.status(400).json(generateResponse(false, 'Invalid phone number format'));
            }

            // Check wallet balance
            const { data: walletData, error: walletError } = await supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', userId)
                .single();

            if (walletError || !walletData) {
                return res.status(404).json(generateResponse(false, 'Wallet not found'));
            }

            const currentBalance = parseFloat(walletData.balance);
            const purchaseAmount = parseFloat(amount);

            if (currentBalance < purchaseAmount) {
                return res.status(400).json(generateResponse(false, 'Insufficient wallet balance'));
            }

            // Calculate reseller discount if applicable
            let discountedAmount = purchaseAmount;
            if (req.user.role === 'reseller' || req.user.role === 'sub_reseller') {
                const { data: resellerData } = await supabase
                    .from('resellers')
                    .select('data_discount')
                    .eq('user_id', userId)
                    .single();

                if (resellerData && resellerData.data_discount) {
                    const discount = parseFloat(resellerData.data_discount);
                    discountedAmount = purchaseAmount * (1 - discount / 100);
                }
            }

            const newBalance = currentBalance - discountedAmount;

            // Create transaction record
            const { data: transactionData, error: transactionError } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'data_purchase',
                    amount: discountedAmount,
                    description: `${network} data purchase for ${phone_number}`,
                    status: 'processing',
                    balance_before: currentBalance,
                    balance_after: newBalance,
                    metadata: {
                        network,
                        phone_number,
                        plan_id,
                        data_amount: purchaseAmount,
                        service_type: 'data'
                    }
                })
                .select()
                .single();

            if (transactionError) {
                return res.status(500).json(generateResponse(false, 'Failed to create transaction record'));
            }

            try {
                // Process data purchase with VTU service
                const vtuResult = await vtuService.purchaseData({
                    network,
                    phone_number,
                    plan_id,
                    amount: purchaseAmount
                });

                if (vtuResult.success) {
                    // Update wallet balance
                    await supabase
                        .from('wallets')
                        .update({
                            balance: newBalance,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', userId);

                    // Update transaction status
                    await supabase
                        .from('transactions')
                        .update({
                            status: 'completed',
                            payment_reference: vtuResult.reference,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', transactionData.id);

                    // Send real-time balance update
                    realtimeHandler.sendBalanceUpdate(userId, newBalance);

                    res.json(generateResponse(true, 'Data purchase successful', {
                        transaction: {
                            ...transactionData,
                            status: 'completed',
                            payment_reference: vtuResult.reference
                        },
                        new_balance: newBalance,
                        vtu_reference: vtuResult.reference
                    }));

                } else {
                    // Update transaction status to failed
                    await supabase
                        .from('transactions')
                        .update({
                            status: 'failed',
                            error_message: vtuResult.message,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', transactionData.id);

                    res.status(400).json(generateResponse(false, vtuResult.message || 'Data purchase failed'));
                }

            } catch (vtuError) {
                console.error('VTU service error:', vtuError);

                // Update transaction status to failed
                await supabase
                    .from('transactions')
                    .update({
                        status: 'failed',
                        error_message: vtuError.message,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', transactionData.id);

                res.status(500).json(generateResponse(false, 'VTU service temporarily unavailable'));
            }

        } catch (error) {
            console.error('Purchase data error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get cable TV providers
    async getCableProviders(req, res) {
        try {
            const providers = await vtuService.getCableProviders();
            res.json(generateResponse(true, 'Cable providers retrieved successfully', providers));
        } catch (error) {
            console.error('Get cable providers error:', error);
            res.status(500).json(generateResponse(false, 'Failed to retrieve cable providers'));
        }
    }

    // Get cable TV packages
    async getCablePackages(req, res) {
        try {
            const { provider } = req.params;
            
            if (!provider) {
                return res.status(400).json(generateResponse(false, 'Provider parameter is required'));
            }

            const packages = await vtuService.getCablePackages(provider);
            res.json(generateResponse(true, 'Cable packages retrieved successfully', packages));
        } catch (error) {
            console.error('Get cable packages error:', error);
            res.status(500).json(generateResponse(false, 'Failed to retrieve cable packages'));
        }
    }

    // Purchase cable TV subscription
    async purchaseCable(req, res) {
        try {
            const userId = req.user.id;
            const { provider, package_id, smartcard_number, amount } = req.body;

            // Validate input
            if (!provider || !package_id || !smartcard_number || !amount) {
                return res.status(400).json(generateResponse(false, 'All fields are required'));
            }

            // Check wallet balance
            const { data: walletData, error: walletError } = await supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', userId)
                .single();

            if (walletError || !walletData) {
                return res.status(404).json(generateResponse(false, 'Wallet not found'));
            }

            const currentBalance = parseFloat(walletData.balance);
            const purchaseAmount = parseFloat(amount);

            if (currentBalance < purchaseAmount) {
                return res.status(400).json(generateResponse(false, 'Insufficient wallet balance'));
            }

            // Calculate reseller discount if applicable
            let discountedAmount = purchaseAmount;
            if (req.user.role === 'reseller' || req.user.role === 'sub_reseller') {
                const { data: resellerData } = await supabase
                    .from('resellers')
                    .select('cable_discount')
                    .eq('user_id', userId)
                    .single();

                if (resellerData && resellerData.cable_discount) {
                    const discount = parseFloat(resellerData.cable_discount);
                    discountedAmount = purchaseAmount * (1 - discount / 100);
                }
            }

            const newBalance = currentBalance - discountedAmount;

            // Create transaction record
            const { data: transactionData, error: transactionError } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'cable_purchase',
                    amount: discountedAmount,
                    description: `${provider} cable subscription for ${smartcard_number}`,
                    status: 'processing',
                    balance_before: currentBalance,
                    balance_after: newBalance,
                    metadata: {
                        provider,
                        package_id,
                        smartcard_number,
                        cable_amount: purchaseAmount,
                        service_type: 'cable'
                    }
                })
                .select()
                .single();

            if (transactionError) {
                return res.status(500).json(generateResponse(false, 'Failed to create transaction record'));
            }

            try {
                // Process cable purchase with VTU service
                const vtuResult = await vtuService.purchaseCable({
                    provider,
                    package_id,
                    smartcard_number,
                    amount: purchaseAmount
                });

                if (vtuResult.success) {
                    // Update wallet balance
                    await supabase
                        .from('wallets')
                        .update({
                            balance: newBalance,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', userId);

                    // Update transaction status
                    await supabase
                        .from('transactions')
                        .update({
                            status: 'completed',
                            payment_reference: vtuResult.reference,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', transactionData.id);

                    // Send real-time balance update
                    realtimeHandler.sendBalanceUpdate(userId, newBalance);

                    res.json(generateResponse(true, 'Cable subscription successful', {
                        transaction: {
                            ...transactionData,
                            status: 'completed',
                            payment_reference: vtuResult.reference
                        },
                        new_balance: newBalance,
                        vtu_reference: vtuResult.reference
                    }));

                } else {
                    // Update transaction status to failed
                    await supabase
                        .from('transactions')
                        .update({
                            status: 'failed',
                            error_message: vtuResult.message,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', transactionData.id);

                    res.status(400).json(generateResponse(false, vtuResult.message || 'Cable subscription failed'));
                }

            } catch (vtuError) {
                console.error('VTU service error:', vtuError);

                // Update transaction status to failed
                await supabase
                    .from('transactions')
                    .update({
                        status: 'failed',
                        error_message: vtuError.message,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', transactionData.id);

                res.status(500).json(generateResponse(false, 'VTU service temporarily unavailable'));
            }

        } catch (error) {
            console.error('Purchase cable error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }

    // Get electricity providers
    async getElectricityProviders(req, res) {
        try {
            const providers = await vtuService.getElectricityProviders();
            res.json(generateResponse(true, 'Electricity providers retrieved successfully', providers));
        } catch (error) {
            console.error('Get electricity providers error:', error);
            res.status(500).json(generateResponse(false, 'Failed to retrieve electricity providers'));
        }
    }

    // Purchase electricity token
    async purchaseElectricity(req, res) {
        try {
            const userId = req.user.id;
            const { provider, meter_number, meter_type, amount, customer_name } = req.body;

            // Validate input
            if (!provider || !meter_number || !meter_type || !amount) {
                return res.status(400).json(generateResponse(false, 'All fields are required'));
            }

            if (amount < 100) {
                return res.status(400).json(generateResponse(false, 'Minimum electricity purchase is ₦100'));
            }

            // Check wallet balance
            const { data: walletData, error: walletError } = await supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', userId)
                .single();

            if (walletError || !walletData) {
                return res.status(404).json(generateResponse(false, 'Wallet not found'));
            }

            const currentBalance = parseFloat(walletData.balance);
            const purchaseAmount = parseFloat(amount);

            if (currentBalance < purchaseAmount) {
                return res.status(400).json(generateResponse(false, 'Insufficient wallet balance'));
            }

            // Calculate reseller discount if applicable
            let discountedAmount = purchaseAmount;
            if (req.user.role === 'reseller' || req.user.role === 'sub_reseller') {
                const { data: resellerData } = await supabase
                    .from('resellers')
                    .select('electricity_discount')
                    .eq('user_id', userId)
                    .single();

                if (resellerData && resellerData.electricity_discount) {
                    const discount = parseFloat(resellerData.electricity_discount);
                    discountedAmount = purchaseAmount * (1 - discount / 100);
                }
            }

            const newBalance = currentBalance - discountedAmount;

            // Create transaction record
            const { data: transactionData, error: transactionError } = await supabase
                .from('transactions')
                .insert({
                    user_id: userId,
                    type: 'electricity_purchase',
                    amount: discountedAmount,
                    description: `${provider} electricity token for ${meter_number}`,
                    status: 'processing',
                    balance_before: currentBalance,
                    balance_after: newBalance,
                    metadata: {
                        provider,
                        meter_number,
                        meter_type,
                        customer_name,
                        electricity_amount: purchaseAmount,
                        service_type: 'electricity'
                    }
                })
                .select()
                .single();

            if (transactionError) {
                return res.status(500).json(generateResponse(false, 'Failed to create transaction record'));
            }

            try {
                // Process electricity purchase with VTU service
                const vtuResult = await vtuService.purchaseElectricity({
                    provider,
                    meter_number,
                    meter_type,
                    amount: purchaseAmount,
                    customer_name
                });

                if (vtuResult.success) {
                    // Update wallet balance
                    await supabase
                        .from('wallets')
                        .update({
                            balance: newBalance,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', userId);

                    // Update transaction status
                    await supabase
                        .from('transactions')
                        .update({
                            status: 'completed',
                            payment_reference: vtuResult.reference,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', transactionData.id);

                    // Send real-time balance update
                    realtimeHandler.sendBalanceUpdate(userId, newBalance);

                    res.json(generateResponse(true, 'Electricity purchase successful', {
                        transaction: {
                            ...transactionData,
                            status: 'completed',
                            payment_reference: vtuResult.reference
                        },
                        new_balance: newBalance,
                        vtu_reference: vtuResult.reference,
                        token: vtuResult.token
                    }));

                } else {
                    // Update transaction status to failed
                    await supabase
                        .from('transactions')
                        .update({
                            status: 'failed',
                            error_message: vtuResult.message,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', transactionData.id);

                    res.status(400).json(generateResponse(false, vtuResult.message || 'Electricity purchase failed'));
                }

            } catch (vtuError) {
                console.error('VTU service error:', vtuError);

                // Update transaction status to failed
                await supabase
                    .from('transactions')
                    .update({
                        status: 'failed',
                        error_message: vtuError.message,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', transactionData.id);

                res.status(500).json(generateResponse(false, 'VTU service temporarily unavailable'));
            }

        } catch (error) {
            console.error('Purchase electricity error:', error);
            res.status(500).json(generateResponse(false, 'Internal server error'));
        }
    }
}

module.exports = new VTUController();
