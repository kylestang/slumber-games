import OAuth from "oauth-1.0a";
import jsSHA from "jssha";
import { DateTime } from "luxon";

interface Env {
    db: D1Database;
};

type User = {
    userId: number,
    username: string,
    oauthToken: string,
    oauthTokenSecret: string,
};

type SleepData = {
    userId: number,
    date: string,
    seconds: number,
};

type SleepResponse = {
    individualStats: {
        calendarDate: string,
        values: {
            totalSleepTimeInSeconds: number,
        },
    }[]
}

type AuthToken = {
    access_token: string
};

type UserAccess = {
    user: User,
    access: AuthToken,
};

// Keys presumably from the android app
// https://github.com/matin/garth/discussions/36
const CONSUMER_KEY = "fc3e99d2-118c-44b8-8ae3-03370dde24c0";
const CONSUMER_SECRET = "E08WAR897WEy2knn7aFBrvegVAf0AFdWBBF";

const EXCHANGE_URL = "https://connectapi.garmin.com/oauth-service/oauth/exchange/user/2.0";
const SLEEP_URL = "https://connectapi.garmin.com/sleep-service/stats/sleep/daily";

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
        await updateAppData(env.db);
    },

    async fetch(_request: Request, env: Env) {
        console.log("Request");
        await updateAppData(env.db);
        return new Response("Done");
    }
};


async function updateAppData(db: D1Database) {
    await setupDB(db);
    const users: User[] = await getUsers(db);
    const userAccess: UserAccess[] = await getAuthTokens(users);
    const sleepData: SleepData[] = await getSleepData(userAccess);
    await storeSleepData(db, sleepData);
    console.log("Done!");
};

async function setupDB(db: D1Database) {
    await db.batch([
        db.prepare(`CREATE TABLE IF NOT EXISTS users (
                    userId INTEGER PRIMARY KEY,
                    username TEXT NOT NULL,
                    oauthToken TEXT NOT NULL,
                    oauthTokenSecret TEXT NOT NULL);`),
        db.prepare(`CREATE TABLE IF NOT EXISTS sleep (
                    userId INTEGER NOT NULL,
                    seconds INTEGER NOT NULL,
                    date TEXT NOT NULL,
                    PRIMARY KEY (userId, date),
                    FOREIGN KEY (userId) REFERENCES users(userId)
                    ON DELETE CASCADE);`
        )]);
}

async function getUsers(db: D1Database): Promise<User[]> {
    const { results } = await db.prepare("SELECT userId, username, oauthToken, oauthTokenSecret FROM users").all<User>();
    return results;
};

async function getAuthTokens(users: User[]): Promise<UserAccess[]> {
    const userAccess: UserAccess[] = [];

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

        const resp = await fetch(req);
        const authToken: AuthToken = await resp.json();
        userAccess.push({ user: user, access: authToken });
    }
    return userAccess;
}

async function getSleepData(accessCreds: UserAccess[]): Promise<SleepData[]> {
    const sleepData: SleepData[] = [];

    const start_date: string = DateTime.now().minus({ days: 14 }).toISODate();
    const end_date: string = DateTime.now().toISODate();
    const url: string = `${SLEEP_URL}/${start_date}/${end_date}`

    for (const userCreds of accessCreds) {

        const authHeader: string = `Bearer ${userCreds.access.access_token}`;

        const req = new Request(url, {
            headers: {
                "Authorization": authHeader,
            }
        });

        const resp = await fetch(req);

        console.log("RESPONSE: " + JSON.stringify(resp));

        const body: SleepResponse = await resp.json();

        for (const day of body.individualStats) {
            sleepData.push({ userId: userCreds.user.userId, seconds: day.values.totalSleepTimeInSeconds, date: day.calendarDate });
        }
    }

    return sleepData;
}

async function storeSleepData(db: D1Database, sleepData: SleepData[]) {
    if (sleepData.length == 0) {
        return;
    }

    const stmt = db.prepare(`INSERT INTO sleep(userId, seconds, date)
                            VALUES(?1, ?2, ?3) ON CONFLICT DO UPDATE SET
                            seconds=?2`);

    const updates = sleepData.map((data) => {
        return stmt.bind(data.userId, data.seconds, data.date);
    });

    await db.batch(updates);
}
