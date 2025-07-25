# Health Check Endpoints

This document describes the health check endpoints available in the StarkTol VTU Backend API.

## Available Endpoints

### 1. `/health` - Detailed Health Check
- **Method**: GET
- **Purpose**: Comprehensive health check with detailed information
- **Response**: JSON with server status, environment, timestamp, and version
- **Use case**: Development, debugging, detailed monitoring

**Example Response:**
```json
{
  "success": true,
  "message": "StarkTol API is running",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "environment": "production",
  "version": "v1"
}
```

### 2. `/healthz` - Render Health Check
- **Method**: GET
- **Purpose**: Fast, lightweight health check optimized for Render.com
- **Response**: Simple JSON status
- **Use case**: Load balancer health checks, Render platform monitoring

**Example Response:**
```json
{
  "status": "ok"
}
```

### 3. `/api/status` - API Status Check
- **Method**: GET
- **Purpose**: Detailed API operational status with service information
- **Response**: JSON with service status breakdown
- **Use case**: Service monitoring, debugging service dependencies

**Example Response:**
```json
{
  "success": true,
  "message": "StarkTol API is operational",
  "services": {
    "database": "connected",
    "vtu_service": "operational",
    "real_time": "active"
  },
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

## Render.com Configuration

For Render deployment, configure the Health Check URL to:
```
/healthz
```

This endpoint is optimized for:
- ✅ Fast response time (< 100ms)
- ✅ Minimal resource usage
- ✅ Simple OK/FAIL status
- ✅ No database dependencies
- ✅ HTTP 200 status code on success

## Implementation Details

Both `server.js` (minimal mode) and `index.js` (full server) include all three health endpoints:

- The `/healthz` endpoint returns immediately with a 200 status
- No external dependencies are checked (database, APIs, etc.)
- Suitable for high-frequency health checks by load balancers
- Does not perform any heavy operations

## Testing

You can test the endpoints locally:

```bash
# Detailed health check
curl http://localhost:8000/health

# Render health check
curl http://localhost:8000/healthz

# API status check
curl http://localhost:8000/api/status
```

## Troubleshooting

If health checks are failing:

1. **Check server logs** for startup errors
2. **Verify port binding** (should listen on 0.0.0.0)
3. **Confirm environment variables** are set correctly
4. **Test locally** before deploying to Render
5. **Check Render logs** for deployment issues

## Best Practices

- Use `/healthz` for automated health checks (Render, load balancers)
- Use `/health` for manual debugging and monitoring dashboards
- Use `/api/status` for detailed service monitoring
- Monitor response times - health checks should be fast (< 1 second)
