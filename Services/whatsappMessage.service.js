const Logger = require('../Helpers/logger');
const axios = require('axios');

const sendTemplateMessage = async (recipient, templateId, params) => {
    try {
        let data = new URLSearchParams({
            source: process.env.GUPSHUP_SOURCE_NUMBER,
            destination: recipient,
            template: JSON.stringify({
                id: templateId,
                params: params
            }),
            'src.name': 'Hercule'
        }).toString();

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: process.env.GUPSHUP_TEMPLATE_MESSAGE_URL,
            headers: {
                apikey: process.env.GUPSHUP_API_KEY,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: data
        };

        const response = await axios.request(config);
        return response;
    } catch (error) {
        Logger.error(error.message + ' Gupshup error');
        return { error: error.response?.data || error.message };
    }
};

module.exports = {
    sendTemplateMessage
}