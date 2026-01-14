const phoneNumberFormater = (phoneNumber) => {
  const phoneArr = phoneNumber.split(' ');

  const newPhone = [];
  let count = 0;

  for (let number of phoneArr) {
    if (count === 0) {
      newPhone.push(number);
      count++;
    } else {
      if (count === 1) {
        newPhone[1] = number.replace(/[^0-9]/g, '');
        count++;
      } else {
        newPhone[1] = newPhone[1] + number.replace(/[^0-9]/g, '');
      }
    }
  }

  return newPhone.join(' ');
};

module.exports = { phoneNumberFormater };
