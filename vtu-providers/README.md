# VTU Provider Integration Guide

## Popular Nigerian VTU Providers

### 1. **Clubkonnect**
- **API Base URL**: `https://www.clubkonnect.com/api/v1/`
- **Auth Method**: API Key + Secret
- **Services**: Airtime, Data, Cable, Electricity, Exam Pins
- **Documentation**: https://clubkonnect.com/api-documentation

### 2. **VTPass** 
- **API Base URL**: `https://vtpass.com/api/`
- **Auth Method**: API Key + Secret Key
- **Services**: Airtime, Data, Cable, Electricity, Insurance
- **Documentation**: https://vtpass.com/documentation

### 3. **BuyAirtime.ng**
- **API Base URL**: `https://www.buyairtime.ng/api/v1/`
- **Auth Method**: API Key + Secret
- **Services**: Airtime, Data, Cable TV, Electricity
- **Documentation**: Contact support

### 4. **Recharge.ng**
- **API Base URL**: `https://api.recharge.ng/v1/`
- **Auth Method**: Bearer Token
- **Services**: Airtime, Data, Cable, Electricity
- **Documentation**: https://recharge.ng/docs

### 5. **Whogohost VTU**
- **API Base URL**: `https://vtu.whogohost.com/api/`
- **Auth Method**: API Key
- **Services**: Airtime, Data, Cable, Electricity
- **Documentation**: https://vtu.whogohost.com/documentation

### 6. **Gsubz**
- **API Base URL**: `https://gsubz.com/api/`
- **Auth Method**: API Key + Secret
- **Services**: Airtime, Data, Cable, Electricity
- **Documentation**: https://gsubz.com/developers

### 7. **SmartRecharge**
- **API Base URL**: `https://smartrecharge.ng/api/v2/`
- **Auth Method**: Username + Password + API Key
- **Services**: Airtime, Data, Cable, Electricity
- **Documentation**: Contact support

## Integration Requirements

To connect your VTU provider, I need:

1. **Provider Name**: Which service are you using?
2. **API Credentials**: 
   - API Key
   - Secret Key (if required)
   - Base URL
   - Any other authentication details

3. **Services Needed**:
   - [ ] Airtime Top-up
   - [ ] Data Bundles  
   - [ ] Cable TV Subscriptions
   - [ ] Electricity Bills
   - [ ] Other services

4. **Environment Variables** to add to your .env:
   ```env
   VTU_PROVIDER_NAME=your_provider
   VTU_PROVIDER_URL=https://api.provider.com
   VTU_API_KEY=your_api_key
   VTU_SECRET_KEY=your_secret_key
   VTU_USERNAME=your_username (if required)
   VTU_PASSWORD=your_password (if required)
   ```

## Next Steps

Once you provide the VTU provider details, I will:

1. ✅ Create the specific provider integration
2. ✅ Update your VTU service with real API calls
3. ✅ Add proper error handling for the provider's responses
4. ✅ Test the connection
5. ✅ Update your environment configuration
6. ✅ Provide testing endpoints

**Please share your VTU provider details and I'll help you connect it immediately!**
