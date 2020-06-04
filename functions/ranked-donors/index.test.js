process.env.RAISELY_TOKEN = 'raisely-token';

const { expect } = require('chai');
const nock = require('nock');
const azureFunction = require('./index');
const cache = require('nano-cache');

const RAISELY_API = 'https://api.raisely.com/v3';
const CAMPAIGN_PATH = 'chris-birthday-wish';

describe('Ranked Donors', () => {
	let context;

	describe('Initial request', () => {
		before(async () => {
			nockDonations();
			cache.clear();
			context = await runRequest();
		});
		itWasSuccessful();
	});
	// Should yield the same result, but without any requests being made
	describe('Second request', () => {
		before(async () => {
			context = await runRequest()
		});
		itWasSuccessful();
	})
	describe('Cache bust', () => {
		let nocks;
		before(async () => {
			nocks = nockDonations();
			context = await runRequest(true);
		});
		itWasSuccessful();
		it('re-fetched content', () => {
			expect(nocks.isDone()).to.be.ok;
		});
	});

	function itWasSuccessful() {
		it('Replied OK', () => {
			expect(context.res).to.deep.eq({
				status: 200,
				body: {
					data: {
						donors: [
							{ uuid: 'uuid1', total: 7000, preferredName: 'Alex', count: 2 },
							{ uuid: 'uuid2', total: 6000, preferredName: 'Sam', count: 1 },
							{ uuid: 'uuid3', total: 1500, preferredName: 'Georgia', count: 1 },
						],
						costumeVotes: [
							{ id: 'cowboy-hat', rank: 1, name: 'Cowboy Hat', total: 2 },
							{ id: 'cape', rank: 2, name: 'Cape', total: 1, photoUrl: 'https://costume.test' },
							{ id: 'boots', rank: 2, name: 'Boots', total: 1 },
						]
					},
				},
			});
		});
	}
});

function nockDonations() {
	nock(RAISELY_API, {
		reqheaders: {
			authorization: `bearer ${process.env.RAISELY_TOKEN}`,
		}
	})
		.get(`/campaigns/${CAMPAIGN_PATH}/fields?private=1`)
		.reply(200, {
			data: [{ name: 'costumeVote', options: [{ label: 'Cowboy Hat', value: 'cowboy-hat' }], uuid: 'costume-field-uuid' }],
		});

	return nock(RAISELY_API)
		.get(`/campaigns/${CAMPAIGN_PATH}/donations?limit=150`)
		.reply(200, {
			data: [
				{ user: { uuid: 'uuid1' }, preferredName: 'Alex', amount: 1000, public: { costumeVote: 'cowboy-hat' } },
				{ user: { uuid: 'uuid2' }, preferredName: 'Sam', amount: 6000, public: { clothing: 'Cowboy Hat' } },
				{ user: { uuid: 'uuid1' }, preferredName: 'Alex', amount: 6000, public: { clothing: 'Cape', pictureOfCostumeItem: 'https://costume.test'} },
				{ user: { uuid: 'uuid3' }, preferredName: 'Georgia', amount: 1500, public: { costumeVote: 'boots'} },
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
