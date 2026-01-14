const axios = require('axios');

const sendOtp = async (mobile, otp) => {
  try {
    const options = {
      method: 'POST',
      url: 'https://control.msg91.com/api/v5/otp',
      params: {
        authkey: process.env.MSG91_AUTHKEY,
        template_id: process.env.MSG91_TEMPLATE_ID,
        mobile: `91${mobile}`,
        otp: otp,
        otp_expiry: 5
      },
      headers: {
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({
        Param1: 'value1',
        Param2: 'value2'
      })
    };

    const { data } = await axios.request(options);
    return {
      success: data.type === 'success',
      type: data.type,
      message: data.message,
      data
    };
  } catch (error) {
    return error.message;
  }
};

const verifyOtp = async (mobile, otp) => {
  try {
    const options = {
      method: 'GET',
      url: 'https://control.msg91.com/api/v5/otp/verify',
      params: {
        authkey: process.env.MSG91_AUTHKEY,
        mobile: `91${mobile}`,
        otp: otp
      },
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const { data } = await axios.request(options);
    return {
      success: data.type === 'success',
      type: data.type,
      message: data.message,
      data
    };
  } catch (error) {
    return error.response?.data || error.message;
  }
};

module.exports = {
  sendOtp,
  verifyOtp
};
