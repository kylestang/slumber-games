export default {
    async scheduled(event, env, ctx) {
        ctx.waitUntil(do_thing(env.db));
    },
};

async function do_thing(db) {

}

// Get user info from db
async function get_users(db) {
    const stmt = db.prepare('SELECT * FROM users');
    const users = await stmt.all();


}

// Get data from garmin

// Update db
