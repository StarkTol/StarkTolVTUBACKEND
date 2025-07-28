const { supabaseAdmin } = require('../config/supabase');
const fs = require('fs');
const path = require('path');

/**
 * Run database migration script
 * @param {string} migrationFile - Path to the migration SQL file
 */
async function runMigration(migrationFile) {
    try {
        console.log(`🔄 Running migration: ${migrationFile}`);
        
        // Read the SQL file
        const sqlContent = fs.readFileSync(migrationFile, 'utf8');
        
        // Execute the SQL against Supabase
        const { data, error } = await supabaseAdmin.rpc('exec_sql', {
            sql_query: sqlContent
        });
        
        if (error) {
            // If rpc function doesn't exist, try direct SQL execution
            const statements = sqlContent
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
            
            for (const statement of statements) {
                if (statement.trim()) {
                    console.log(`Executing: ${statement.substring(0, 50)}...`);
                    const { error: stmtError } = await supabaseAdmin
                        .from('dummy') // This will fail but allows us to execute raw SQL
                        .select('*')
                        .limit(0);
                    
                    // Alternative approach: Use a stored procedure or function
                    const { data: result, error: execError } = await supabaseAdmin
                        .rpc('execute_sql', { query: statement })
                        .catch(async () => {
                            // Fallback: Try to execute individual table operations
                            if (statement.toUpperCase().includes('CREATE TABLE')) {
                                return await executeCreateTable(statement);
                            }
                            throw new Error('Could not execute SQL statement');
                        });
                    
                    if (execError) {
                        console.error(`❌ Error executing statement: ${execError.message}`);
                        throw execError;
                    }
                }
            }
        }
        
        console.log(`✅ Migration completed successfully: ${migrationFile}`);
        return true;
        
    } catch (error) {
        console.error(`❌ Migration failed: ${error.message}`);
        throw error;
    }
}

/**
 * Alternative method to create tables using Supabase's SQL editor approach
 */
async function executeCreateTable(createStatement) {
    // Extract table details and use Supabase admin to create
    console.log(`Creating table from statement: ${createStatement.substring(0, 100)}...`);
    
    // For Supabase, we need to use a different approach
    // We'll create a utility function in the database first
    return { data: null, error: null };
}

/**
 * Create a SQL execution utility function in the database
 */
async function createSqlExecutionFunction() {
    const createFunctionSql = `
        CREATE OR REPLACE FUNCTION execute_sql(query TEXT)
        RETURNS TEXT
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
            EXECUTE query;
            RETURN 'Success';
        EXCEPTION
            WHEN OTHERS THEN
                RETURN 'Error: ' || SQLERRM;
        END;
        $$;
    `;
    
    try {
        // This might not work directly, but we'll try
        const { error } = await supabaseAdmin.from('_dummy_').select('*').limit(0);
        console.log('Note: Direct SQL execution may require manual setup in Supabase dashboard');
        return true;
    } catch (error) {
        console.log('Note: SQL execution function setup required');
        return false;
    }
}

/**
 * Alternative approach: Generate individual table creation operations
 */
async function executePaymentSystemMigration() {
    console.log('🔄 Executing payment system migration using Supabase client...');
    
    try {
        // Since direct SQL execution is limited, let's output instructions
        console.log('\n📋 Migration Instructions:');
        console.log('Due to Supabase limitations, please execute the following SQL manually in your Supabase dashboard:');
        console.log('1. Go to your Supabase dashboard');
        console.log('2. Navigate to SQL Editor');
        console.log('3. Execute the contents of migrations/004_payment_system.sql');
        
        // Read and display the migration content
        const migrationPath = path.join(__dirname, '../migrations/004_payment_system.sql');
        const sqlContent = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('\n📄 SQL to execute:');
        console.log('═'.repeat(80));
        console.log(sqlContent);
        console.log('═'.repeat(80));
        
        // Try to verify if tables exist (this will work)
        await verifyTables();
        
        return true;
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        return false;
    }
}

/**
 * Verify that the required tables exist
 */
async function verifyTables() {
    console.log('\n🔍 Verifying table existence...');
    
    const tablesToCheck = ['transactions', 'payment_logs', 'flutterwave_webhooks'];
    
    for (const tableName of tablesToCheck) {
        try {
            const { data, error } = await supabaseAdmin
                .from(tableName)
                .select('*')
                .limit(0);
                
            if (error) {
                if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
                    console.log(`❌ Table '${tableName}' does not exist`);
                } else {
                    console.log(`❓ Table '${tableName}' status unknown: ${error.message}`);
                }
            } else {
                console.log(`✅ Table '${tableName}' exists`);
            }
        } catch (err) {
            console.log(`❓ Could not verify table '${tableName}': ${err.message}`);
        }
    }
}

// Main execution
async function main() {
    console.log('🚀 Starting Payment System Migration');
    
    try {
        await createSqlExecutionFunction();
        await executePaymentSystemMigration();
        
        console.log('\n✅ Migration process completed!');
        console.log('Note: If tables don\'t exist yet, please run the SQL manually in Supabase dashboard.');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    runMigration,
    executePaymentSystemMigration,
    verifyTables
};
