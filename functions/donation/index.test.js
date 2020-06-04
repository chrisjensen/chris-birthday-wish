// Set up test values for these secrets
process.env.WEBHOOK_SECRET = 'test-secret';
process.env.RAISELY_TOKEN = 'raisely-token';
process.env.RANKING_URL = 'https://azure.test/rankDonors';

const azureFunction = require('./index');
const nock = require('nock');
const { expect } = require('chai');

const RAISELY_API = 'https://api.raisely.com/v3'
const CAMPAIGN_PATH = 'chris-birthday-wish';

const donors = [
	{ total: 7000, preferredName: 'Mel' },
	{ total: 4000, preferredName: 'Andy' },
];

const donation = {
	// They just clear the threshold to add an item of clothing
	amount: 6000,
	user: { uuid: 'user1-uuid' },
	public: { clothing: 'Cowboy Hat', pictureOfCostumeItem: 'https://cowboy-hats.test' },
}

describe('Donation Webhook', () => {
	let fieldsRequest;
	let emailEvents;
	let context;

	before(async () => {
		// Nock raisely field update
		fieldsRequest = nockRaiselyFields();
		// Nock ranking cloud function
		nockRankingFunction();
		nockUserGet();

		emailEvents = nockEmailTriggers();

		context = await runRequest();
	});

	it('Responds OK', () => {
		expect(context.res).to.containSubset({
			status: 200,
			body: {
				addedClothing: true,
				rankingChanged: true,
			},
		})
	})

	it('Updates fields', () => {
		expect(fieldsRequest.body).to.containSubset({
			options: [{ label: 'Option 1', value: 'option1' }, { label: 'Cowboy Hat', value: 'cowboy-hat' }],
		})
	});

	it('Triggers leader email', () => {
		expect(emailEvents).to.containSubset([{
			data: {
				type: 'raisely.custom',
				version: 1,
				data: {
					preferredName: 'Mel',
					email: 'mel@bday.test',
					amountToLead: 31,
					messageType: 'lead-gained',
				},
			},
		}]);
	});

	it('Triggers second place email', () => {
		expect(emailEvents).to.containSubset([{
			data: {
				type: 'raisely.custom',
				version: 1,
				data: {
					preferredName: 'Andy',
					email: 'andy@bday.test',
					amountToLead: 31,
					messageType: 'lead-lost',
				},
			},
		}]);
	});
});

function nockRaiselyFields() {
	const result = {};
	nock(RAISELY_API, {
		reqheaders: {
			authorization: `bearer ${process.env.RAISELY_TOKEN}`,
		}
	})
		.get(`/campaigns/${CAMPAIGN_PATH}/fields?private=true`)
		.reply(200, {
			data: [{ name: 'costumeVote', options: [{ label: 'Option 1', value: 'option1' }], uuid: 'costume-field-uuid' }],
		})

		.patch(`/fields/costume-field-uuid`)
		.reply((url, body) => {
			result.body = body;
			return [200, { data: [] }];
		});

	return result;
}

function nockUserGet() {
	const result = {};
	nock(RAISELY_API, {
		reqheaders: {
			authorization: `bearer ${process.env.RAISELY_TOKEN}`,
		}
	})
		.get(`/users/user2-uuid?private=true`)
		.reply(200, {
			data: {
				uuid: 'user2-uuid',
				preferredName: 'Andy',
				fullName: 'Andy Man',
				email: 'andy@bday.test',
			},
		})

	return result;
}

function nockRankingFunction() {
	return nock('https://azure.test/')
		.get('/rankDonors?clearCache=1')
		.reply(200, { data: { donors }})
}

function nockEmailTriggers() {
	const results = [];

	nock('https://communications.raisely.com/v1', {
		reqheaders: {
			authorization: `bearer raisely:${process.env.RAISELY_TOKEN}`,
		}
	})
		.post('/events')
		.reply((url, body) => {
			results.push(body);
			return [200, { data: [] }];
		});

	return results;
}

async function runRequest() {
	const context = { log: console.log };

	const req = {
		body: {
			secret: process.env.WEBHOOK_SECRET,
			data: {
				data: donation
			},
		},
	};

	await azureFunction(context, req);
}
