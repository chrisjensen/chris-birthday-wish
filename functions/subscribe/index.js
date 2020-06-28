const _ = require('lodash');
const axios = require('axios');

const RAISELY_API = 'https://api.raisely.com/v3'
const RAISELY_TOKEN = process.env.RAISELY_TOKEN;

const ALLOWED_ORIGINS = ['.raisely.com', '.chrisjensen.info'];

module.exports = async function (context, req) {
	const origin = _.get(req, 'headers.origin');
	const safeOrigin = origin && ALLOWED_ORIGINS.find(o => origin.endsWith(o));
	if (!safeOrigin) {
		context.log.error(`Unknown origin ${origin}`);
		context.res = {
			status: 403,
			body: {
				error: 'Unknown origin not permitted',
			},
		};
		return;
	}

	const { userUuid, subscription } = _.get(req, 'body.data', {});
	if (!(userUuid && subscription)) {
		context.log.error(`Bad payload`);
		context.res = {
			status: 400,
			body: {
				error: 'Missing payload. Please pass userUuid and subscription in body.data',
			},
		};
		return;
	}

	context.log(`Adding push subscription for user ${userUuid}`);

	try {
		const response = await axios(`${RAISELY_API}/users/${userUuid}`, {
			method: 'PATCH',
			headers: { authorization: `bearer ${RAISELY_TOKEN}` },
			body: {
				data: {
					private: { subscription: JSON.stringify('subscription') }
				},
			},
		});

		context.res = {
			status: 200,
			body: {
				message: 'Subscription saved',
			},
		};
	} catch (err) {
		context.log.error(`An error occurred saving the user subscription`, err);
		context.res = {
			status: 500,
			body: {
				error: 'Unknown error saving the subscription',
			},
		};
	}
};

