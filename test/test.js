const { init } = require('../server');
const axios = require('axios');

// Mock axios
jest.mock('axios');

describe('Server Endpoint Tests', () => {
    let server;

    beforeEach(async () => {
       
        process.env.TOKEN = 'test-token';
        process.env.AWS_REGION = 'us-east-1';
        process.env.S3_BUCKET = 'mrad-node-uploads';

        // Initialize server before each test
        server = await init();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const mockStationData = {
        data: {
            data: {
                stations: [
                    {
                        station_id: "1234",
                        capacity: 10,
                        external_id: "ext1234",
                        legacy_id: "leg1234",
                        short_name: "TEST1",
                        electric_bike_surcharge_waiver: false,
                        station_type: "classic",
                        lon: -87.123,
                        lat: 41.123,
                        has_kiosk: true,
                        name: "Test Station 1",
                        rental_methods: ["KEY"],
                        rental_uris: null
                    }
                ]
            }
        }
    };

    it('should successfully process and filter stations', async () => {
        axios.get.mockResolvedValueOnce(mockStationData);

        const response = await server.inject({
            method: 'GET',
            url: '/',
            headers: {
                'authorization': process.env.TOKEN
            }
        });

        const result = JSON.parse(response.payload);

        expect(result.statusCode).toBe(200);
        expect(result.body.message).toBe('Processing complete');

        const filteredStations = result.body.stations;
        expect(filteredStations).toHaveLength(1);
        expect(filteredStations[0]).toMatchObject({
            stationId: "1234",
            capacity: 10,
            short_name: "TEST1"
        });
    });

    it('should handle API errors', async () => {
        axios.get.mockRejectedValueOnce(new Error('API Error'));

        const response = await server.inject({
            method: 'GET',
            url: '/',
            headers: {
                'authorization': process.env.TOKEN
            }
        });

        const result = JSON.parse(response.payload);
        expect(result.statusCode).toBe(400);
        expect(result.body.message).toBe('Error processing data');
    });

    it('should reject requests without authorization token', async () => {
        const response = await server.inject({
            method: 'GET',
            url: '/',
            headers: {}
        });

        expect(response.statusCode).toBe(401);
    });

    it('should reject requests with invalid token', async () => {
        const response = await server.inject({
            method: 'GET',
            url: '/',
            headers: {
                'authorization': 'wrong-token'
            }
        });

        expect(response.statusCode).toBe(401);
    });

    it('should properly transform station data', async () => {
        axios.get.mockResolvedValueOnce(mockStationData);

        const response = await server.inject({
            method: 'GET',
            url: '/',
            headers: {
                'authorization': process.env.TOKEN
            }
        });

        const result = JSON.parse(response.payload);
        const station = result.body.stations[0];

        expect(station).toHaveProperty('stationId');
        expect(station).toHaveProperty('legacyId');
        expect(station).not.toHaveProperty('station_id');
        expect(station).not.toHaveProperty('legacy_id');
        expect(station).not.toHaveProperty('rental_methods');
        expect(station).not.toHaveProperty('rental_uris');
    });

});