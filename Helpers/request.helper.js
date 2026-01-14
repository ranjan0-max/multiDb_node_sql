function extractPagination(req) {
    let page;
    let limit;
    if (req?.query?.page && req?.query?.limit) {
        page = req.query.page ? parseInt(req.query.page) : null;
        limit = req.query.limit ? parseInt(req.query.limit) : null;
    } else {
        page = parseInt(req.page)
        limit = parseInt(req.limit);
    }
    const skip = page && limit ? (page - 1) * limit : null;

    if (req?.query?.page && req?.query?.limit) {
        delete req.query.page;
        delete req.query.limit;
    } else {
        delete req.page;
        delete req.limit;
    }
    return { page, limit, skip };
}

module.exports = {
    extractPagination
};
