function dateValidator(incomingDate) {
    const dateFormat = /^\d{4}-\d{1,2}-\d{1,2}$/;

    if (!(dateFormat.test(incomingDate.startDate)) || (!dateFormat.test(incomingDate.endDate))) {
        return "Invalid Date format";
    } else {
        return null;
    }
}

module.exports = { dateValidator };
