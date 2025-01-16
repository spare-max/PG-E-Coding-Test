'use strict';

require('dotenv').config();
const Hapi = require('@hapi/hapi');
const Boom = require('@hapi/boom');
const fs = require('fs').promises;
const { Parser } = require('json2csv');
const axios = require('axios');
const AWS = require('aws-sdk');

const renameKeys = (obj) => {
    const renamed = { ...obj };
    if (renamed.external_id) {
        renamed.externalId = renamed.external_id;
        delete renamed.external_id;
    }
    if (renamed.station_id) {
        renamed.stationId = renamed.station_id;
        delete renamed.station_id;
    }
    if (renamed.legacy_id) {
        renamed.legacyId = renamed.legacy_id;
        delete renamed.legacy_id;
    }
    delete renamed.rental_methods;
    delete renamed.rental_uris;
    return renamed;
};

const validateToken = async (req, token) => {
    const isValid = token === process.env.TOKEN;

    return {
        isValid,
        credentials: { token },
        artifacts: {}
    }
}

const init = async () => {
    const server = Hapi.server({
        port: process.env.PORT || 3000,
        host: '0.0.0.0',
        routes: {
            cors: {
                origin: ['*'],
                headers: ['Authorization', 'Content-Type'],
                additionalHeaders: ['X-Requested-With']
            }
        }
    });

    server.auth.scheme('token-auth', (server, options) => ({
        authenticate: async (request,h) => {
            const token = request.headers['authorization'];

            if (!token){
            throw Boom.unauthorized('No token provided');
            }

            const { isValid, credentials, artifacts } = await validateToken(request, token);

            if (!isValid){
            throw Boom.unauthorized('Invalid token');
            }

            return h.authenticated({ credentials, artifacts });

        }
    }));

    server.auth.strategy('api-token','token-auth');

    server.auth.default('api-token');

    server.route({
        method: 'GET',
        path: '/',
        handler: async (request, h) => {
            try {
                const URL = "https://gbfs.divvybikes.com/gbfs/en/station_information.json" ;
                const response = await axios.get(URL);
                const stations = response.data.data.stations;

                console.log("Res:", stations);

                const filteredData = stations
                    .map(renameKeys)
                    .filter((station) => station.capacity < 12); 

                const fields = [
                    'stationId',
                    'legacyId',
                    'short_name',
                    'station_type',
                    'electric_bike_surcharge_waiver',
                    'eightd_station_services',
                    'eightd_has_key_dispenser',
                    'has_kiosk',
                    'name',
                    'capacity',
                    'lat',
                    'lon',
                ];

                const parser = new Parser({ fields });
                const csvData = parser.parse(filteredData);

                const filename = `stations-${Date.now()}.csv`;
                await fs.writeFile(`${filename}`, csvData);

                const s3 = new AWS.S3({
                    region: process.env.AWS_REGION || 'us-east-1'
                });

                const params = {
                    Bucket: process.env.S3_BUCKET,
                    Key: filename,
                    Body: csvData,
                    ContentType: 'text/csv'
                };

                await s3.upload(params).promise();

                console.log('Response Code: 200')
                
                return {
                    statusCode: 200,
                    body: {
                        message: 'Processing complete',
                        stations: filteredData
                    }
                };

            } catch (error) {
                console.log('Error processing data:', error);
                return h.response({
                    statusCode: 400,
                    body: {
                        message: 'Error processing data',
                        error: error.message
                    }
                }).code(400);
            }
        },
        options: {
            auth: 'api-token'
        }
    });

    await server.initialize();
    return server;
};

module.exports = {
    init,
    handler: async (event, context) => {
        const server = await init();

        const request = {
            method: event.httpMethod || 'GET',
            url: event.path || '/',
            headers: event.headers || {},
            payload: event.body ? JSON.parse(event.body) : null
        };

        try {
            const response = await server.inject(request);
            return {
                statusCode: response.statusCode,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                },
                body: JSON.stringify(response.result)
            };
        } catch (error) {
            console.log('Lambda execution error:', error);
            return {
                statusCode: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                },
                body: JSON.stringify({
                    message: 'Internal server error',
                    error: error.message
                })
            };
        }
    }
};