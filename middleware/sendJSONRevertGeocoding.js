const _ = require('lodash');
const es = require('elasticsearch');
const logger = require('pelias-logger').get('api');
const PeliasParameterError = require('../sanitizer/PeliasParameterError');
const PeliasTimeoutError = require('../sanitizer/PeliasTimeoutError');

function isParameterError(error) {
    return error instanceof PeliasParameterError;
}

function isTimeoutError(error) {
    return error instanceof PeliasTimeoutError ||
        error instanceof es.errors.RequestTimeout;
}

function isElasticsearchError(error) {
    const knownErrors = [es.errors.NoConnections,
    es.errors.ConnectionFault];

    return knownErrors.some(function (esError) {
        return error instanceof esError;
    });
}

function sendJSONResponse(req, res, next) {

    // do nothing if no result data set
    const geocoding = _.get(res, 'body.geocoding');

    if (!_.isPlainObject(geocoding)) {
        return next();
    }

    const errors = geocoding.errors || [];

    const errorCodes = errors.map(function (error) {
        if (isParameterError(error)) {
            return 400;
        } else if (isTimeoutError(error) || isElasticsearchError(error)) {
            return 502;
        } else {
            return 500;
        }
    });

    const statusCode = Math.max(200, ...errorCodes);

    const result = res.body.features.map((data) => {
        const item = {}

        const address_components = data?.properties?.addendum?.pelias?.addressComponents.map((item) => {
            return {
                "long_name": item.name,
                "short_name": item.name,
                "types": [
                    ...item.types
                ]
            }
        })
        item.address_components = address_components
        item.formatted_address = data?.properties?.name
        item.geometry = {
            "location": {
                "lat": data.geometry.coordinates[1],
                "lng": data.geometry.coordinates[0]
            },
            "location_type": "",
            "viewport": {
                "northeast": {
                    "lat": "",
                    "lng": ""
                },
                "southwest": {
                    "lat": "",
                    "lng": ""
                }
            }
        }
        item.place_id = data.properties.gid
        item.plus_code = {
            "compound_code": "",
            "global_code": ""
        }
        item.types = []
        return item
    })

    return res.status(statusCode).json({
        "plus_code": {
            "compound_code": "QM8M+C8W District 1, Ho Chi Minh City, Vietnam",
            "global_code": "7P28QM8M+C8W"
        },
        "results": result,
        "status": "OK"
    });
}

module.exports = sendJSONResponse;
