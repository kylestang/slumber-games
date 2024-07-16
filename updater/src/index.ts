import OAuth from "oauth-1.0a";
import jsSHA from "jssha";

interface Env {
    db: D1Database;
}

type User = {
    userId: number,
    oauthToken: string,
    oauthTokenSecret: string,
};

type SleepData = {
    userId: number,
    date: string,
    seconds: number,
}

type AuthToken = {
    access_token: string
}

// Keys presumably from the android app
// https://github.com/matin/garth/discussions/36
const CONSUMER_KEY = "fc3e99d2-118c-44b8-8ae3-03370dde24c0"
const CONSUMER_SECRET = "E08WAR897WEy2knn7aFBrvegVAf0AFdWBBF"

const EXCHANGE_URL = "https://connectapi.garmin.com/oauth-service/oauth/exchange/user/2.0";

const OAUTH_BASE = new OAuth({
    consumer: {
        key: CONSUMER_KEY,
        secret: CONSUMER_SECRET,
    },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string: string, key: string) {
        return new jsSHA("SHA-1",
            "TEXT",
            {
                hmacKey: { value: key, format: "TEXT" },
            }).update(base_string).getHash("B64");
    },
});

export default {
    async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
        console.log("Schedule");
        await doThing(env.db);
    },

    async fetch(_request: Request, env: Env) {
        console.log("Request");
        await doThing(env.db);
        return new Response("Done");
    }
};


async function doThing(db: D1Database) {
    await setupDB(db);
    const users: User[] = await getUsers(db);
    await getAuthTokens(users);
    console.log("Done!");
};

async function setupDB(db: D1Database) {
    await db.batch([
        db.prepare(`CREATE TABLE IF NOT EXISTS users (
                    userId INT PRIMARY KEY,
                    oauthToken TEXT,
                    oauthTokenSecret TEXT);`),
        db.prepare(`CREATE TABLE IF NOT EXISTS sleep (
                    userId INT,
                    seconds INT,
                    date TEXT,
                    PRIMARY KEY (userId, date),
                    FOREIGN KEY (userId) REFERENCES users(userId));`
        )]);
}

async function getUsers(db: D1Database): Promise<User[]> {
    const { results } = await db.prepare("SELECT userId, oauthToken, oauthTokenSecret FROM users").all<User>();
    console.log(results);
    return results;
};

async function getAuthTokens(users: User[]) {
    const authTokens = [];

    for (const user of users) {

        const requestData = {
            url: EXCHANGE_URL,
            method: 'POST',
        }

        const token = {
            key: user.oauthToken,
            secret: user.oauthTokenSecret,
        }

        const authorization = OAUTH_BASE.authorize(requestData, token);
        const headers = OAUTH_BASE.toHeader(authorization);

        const req = new Request(requestData.url, {
            method: requestData.method,
            headers: {
                "Authorization": headers.Authorization,
                "User-Agent": "com.garmin.android.apps.connectmobile",
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept-Encoding": "gzip, deflate",
                "Accept": "*/*",
            },
        });

        req.headers.forEach((value, key) => {
            console.log(key + ": " + value);
        });

        const resp = await fetch(req);
    }
}
