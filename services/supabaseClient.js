const { supabase, supabaseAdmin } = require('../config/supabase');

class SupabaseClient {
    constructor() {
        this.client = supabase;
        this.admin = supabaseAdmin;
    }

    // Generic query builder
    from(table) {
        return this.client.from(table);
    }

    // Admin operations
    adminFrom(table) {
        return this.admin.from(table);
    }

    // Authentication operations
    auth() {
        return this.client.auth;
    }

    adminAuth() {
        return this.admin.auth;
    }

    // Real-time subscriptions
    subscribe(table, callback, filters = {}) {
        let subscription = this.client
            .channel(`${table}_changes`)
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: table,
                    ...filters
                }, 
                callback
            );

        subscription.subscribe();
        return subscription;
    }

    // Unsubscribe from real-time updates
    unsubscribe(subscription) {
        return this.client.removeChannel(subscription);
    }

    // Storage operations
    storage() {
        return this.client.storage;
    }

    // Database functions
    async rpc(functionName, params = {}) {
        return await this.client.rpc(functionName, params);
    }

    // Transaction wrapper
    async transaction(callback) {
        try {
            // Supabase doesn't have explicit transaction support in the client
            // This is a placeholder for future implementation
            return await callback(this.client);
        } catch (error) {
            throw error;
        }
    }

    // Batch operations
    async batchInsert(table, data, options = {}) {
        const batchSize = options.batchSize || 1000;
        const results = [];

        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            const { data: batchResult, error } = await this.client
                .from(table)
                .insert(batch)
                .select();

            if (error) {
                throw error;
            }

            results.push(...batchResult);
        }

        return results;
    }

    // Batch update operations
    async batchUpdate(table, updates) {
        const results = [];

        for (const update of updates) {
            const { data, error } = await this.client
                .from(table)
                .update(update.data)
                .eq('id', update.id)
                .select();

            if (error) {
                throw error;
            }

            results.push(...data);
        }

        return results;
    }

    // Health check
    async healthCheck() {
        try {
            const { data, error } = await this.client
                .from('users')
                .select('count')
                .limit(1);

            return !error;
        } catch (error) {
            return false;
        }
    }

    // Get database info
    async getDatabaseInfo() {
        try {
            const { data, error } = await this.client.rpc('get_database_info');
            return { data, error };
        } catch (error) {
            return { data: null, error };
        }
    }

    // Utility method to handle common error patterns
    handleSupabaseError(error) {
        if (!error) return null;

        const errorMap = {
            'PGRST116': 'Resource not found',
            '23505': 'Duplicate entry',
            '23503': 'Referenced resource not found',
            '42P01': 'Table does not exist',
            '42703': 'Column does not exist',
            'PGRST301': 'Row level security violation'
        };

        return {
            code: error.code,
            message: errorMap[error.code] || error.message,
            details: error.details,
            hint: error.hint
        };
    }

    // Pagination helper
    async paginatedQuery(table, options = {}) {
        const {
            page = 1,
            limit = 20,
            orderBy = 'created_at',
            ascending = false,
            filters = {},
            select = '*'
        } = options;

        const offset = (page - 1) * limit;

        let query = this.client
            .from(table)
            .select(select, { count: 'exact' })
            .order(orderBy, { ascending })
            .range(offset, offset + limit - 1);

        // Apply filters
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                if (typeof value === 'object' && value.operator) {
                    // Handle custom operators like { operator: 'gte', value: '2023-01-01' }
                    query = query[value.operator](key, value.value);
                } else {
                    query = query.eq(key, value);
                }
            }
        });

        const { data, error, count } = await query;

        if (error) {
            throw error;
        }

        return {
            data,
            pagination: {
                page,
                limit,
                total: count,
                totalPages: Math.ceil(count / limit),
                hasNext: page * limit < count,
                hasPrev: page > 1
            }
        };
    }
}

module.exports = new SupabaseClient();
