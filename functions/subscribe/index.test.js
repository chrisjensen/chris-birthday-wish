process.env.RAISELY_TOKEN = 'raisely-token';

const { expect } = require('chai');
const nock = require('nock');
const azureFunction = require('./index');

const RAISELY_API = 'https://api.raisely.com/v3';

describe('Save Subscription', () => {
	let context;

	before(async () => {
		nockUpdateUser();
		context = await runRequest();
		console.log(context)
	});
	itWasSuccessful();
	function itWasSuccessful() {
		it('Replied OK', () => {
			expect(context.res).to.deep.eq({
				status: 200,
				body: {
					message: 'Subscription saved',
				},
			});
		});
	}
});

function nockUpdateUser() {
	nock(RAISELY_API, {
		reqheaders: {
			authorization: `bearer ${process.env.RAISELY_TOKEN}`,
		},
	})
		.log(console.log)
		.patch(`/users/user-uuid`)
		.reply(200, {
			data: {},
		});
}

async function runRequest() {
	const context = { log: console.log };
	context.log.error = console.error;

	const req = {
		headers: {
			origin: 'https://test.raisely.com',
		},
		body: {
			data: {
				userUuid: 'user-uuid',
				subscription: { key: 'XXX' },
			},
		},
	}

	await azureFunction(context, req);

	return context;
}
