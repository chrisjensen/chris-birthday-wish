process.env.RAISELY_TOKEN = 'raisely-token';

const { expect } = require('chai');
const nock = require('nock');
const azureFunction = require('./index');

const RAISELY_API = 'https://api.raisely.com/v3';
const CAMPAIGN_PATH = 'chris-birthday-wish';

describe('Ranked Donors', () => {
	let context;

	describe('Initial request', () => {
		before(async () => {
			nockDonations();
			context = await runRequest();
		});
		itWasSuccessful();
	});
	// Should yield the same result, but without any requests being made
	describe('Second request', () => {
		before(() => runRequest());
		itWasSuccessful();
	})
	describe('Cache bust', () => {
		before(() => runRequest(true));
		itWasSuccessful();
	});

	function itWasSuccessful() {
		it('Replied OK', () => {
			expect(context.res).to.deep.eq({
				status: 200,
				body: {
					data: {
						donors: [
							{ total: 7000, preferredName: 'Alex', },
							{ total: 6000, preferredName: 'Sam', },
						],
						costumeVotes: [
							{ rank: 1, name: 'Cowboy Hat', total: 2 },
							{ rank: 2, name: 'Cape', total: 1 },
							{ rank: 2, name: 'Boots', total: 1 },
						]
					},
				},
			})
		});
	}
});

function nockDonations() {
	nock(RAISELY_API, {
		reqheaders: {
			authorization: `bearer ${process.env.RAISELY_TOKEN}`,
		}
	})
		.get(`/campaigns/${CAMPAIGN_PATH}/fields?private=true`)
		.reply(200, {
			data: [{ name: 'costumeVote', options: [{ label: 'Cowboy Hat', value: 'cowboy-hat' }], uuid: 'costume-field-uuid' }],
		});

	return nock(RAISELY_API)
		.get(`/campaigns/${CAMPAIGN_PATH}/donations`)
		.reply(200, {
			data: [
				{ user: { uid: 'uuid1' }, preferredName: 'Alex', amount: 1000, public: { costumeVote: 'cowboy-hat'} },
				{ user: { uid: 'uuid2' }, preferredName: 'Sam', amount: 6000, public: { clothing: 'Cowboy Hat' } },
				{ user: { uid: 'uuid1' }, preferredName: 'Alex', amount: 6000, public: { costumeVote: 'cape'} },
				{ user: { uid: 'uuid3' }, preferredName: 'Georgia', amount: 1500, public: { costumeVote: 'boots'} },
			],
		});
}

async function runRequest(bustCache) {
	const context = { log: console.log };

	const req = {
		query: { clearCache: !!bustCache },
	}

	await azureFunction(context, req);

	return context;
}
