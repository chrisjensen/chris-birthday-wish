// Set up test values for these secrets
process.env.WEBHOOK_SECRET = 'test-secret';
process.env.RAISELY_TOKEN = 'raisely-token';
process.env.RANKING_URL = 'https://azure.test/rankDonors';

const azureFunction = require('./index');
const nock = require('nock');
const chai = require('chai');
const chaiSubset = require('chai-subset');

chai.use(chaiSubset);
const { expect } = chai;

const RAISELY_API = 'https://api.raisely.com/v3'
const CAMPAIGN_PATH = 'chris-birthday-wish';

const donors = [
	{ total: 7000, preferredName: 'Mel', uuid: 'user1-uuid' },
	{ total: 4000, preferredName: 'Andy', uuid: 'user2-uuid' },
];

const donation = {
	// They just clear the threshold to add an item of clothing
	amount: 6000,
	user: { uuid: 'user1-uuid' },
	public: { clothing: 'Cowboy Hat', pictureOfCostumeItem: 'https://cowboy-hats.test' },
	email: 'mel@bday.test',
	preferredName: 'Mel',
}

describe('Donation Webhook', () => {
	let fieldUpdates;
	let emailEvents;
	let context;

	before(async () => {
		nock.cleanAll();
		// Nock raisely field update
		fieldUpdates = nockRaiselyFields();
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
		expect(fieldUpdates).to.containSubset([
			{ options: [{ label: 'Cowboy Hat', value: 'cowboy-hat', photoUrl: 'https://cowboy-hats.test' }, { label: 'Option 1', value: 'option1' }] },
			{ default: 'Black Crew Top' },
			{ default: 'https://raisely-images.imgix.net/chris-birthday-wish/uploads/68972042-1-f-jpg-4cc7ed.jpg' },
		]);
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
	const result = [];
	nock(RAISELY_API)
		.get(`/campaigns/${CAMPAIGN_PATH}/donations?limit=150`)
		.reply(200, {
			data: [
				{ user: { uuid: 'uuid1' }, preferredName: 'Alex', amount: 1000, public: { costumeVote: 'cowboy-hat' } },
				{ user: { uuid: 'uuid2' }, preferredName: 'Sam', amount: 6000, public: { clothing: 'Cowboy Hat' } },
				{ user: { uuid: 'uuid1' }, preferredName: 'Alex', amount: 6000, public: { clothing: 'Cape', pictureOfCostumeItem: 'https://costume.test'} },
				{ user: { uuid: 'uuid3' }, preferredName: 'Georgia', amount: 1500, public: { costumeVote: 'boots'} },
			],
		});

	nock(RAISELY_API, {
		reqheaders: {
			authorization: `bearer ${process.env.RAISELY_TOKEN}`,
		}
	})
		.get(`/campaigns/${CAMPAIGN_PATH}/fields?private=true`)
		.reply(200, {
			data: [
				{ name: 'costumeVote', options: [{ label: 'Option 1', value: 'option1' }], uuid: 'costume-field-uuid' },
				{ name: 'clothing', uuid: 'costume-description-field-uuid' },
				{ name: 'pictureOfCostumeItem', uuid: 'picture-of-costume-uuid' },
			],
		})

		.persist()
		.patch(/\/fields\/.*/)
		.reply((url, body) => {
			result.push(body.data);
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
		.persist()
		.post('/events')
		.reply((url, body) => {
			results.push(body);
			return [200, { data: [] }];
		});

	return results;
}

async function runRequest() {
	const context = { log: console.log };
	context.log.error = console.error;

	const req = {
		body: {
			secret: process.env.WEBHOOK_SECRET,
			data: {
				data: donation
			},
		},
	};

	await azureFunction(context, req);

	return context;
}
