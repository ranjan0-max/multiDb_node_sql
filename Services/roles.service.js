const DB = require('../Helpers/crud.helper');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getSearchQuery(searchValue, query) {
    let whereQuery = { ...query, AND: [] }

    let role = await DB.findManyDetails(prisma.role, {})

    let matchedRoleIds = []
    if (searchValue) {
        matchedRoleIds = role
            .filter(user => user.name?.toLowerCase().includes(searchValue.toLowerCase()))
            .map(user => user.id);
    }

    if (searchValue && searchValue.trim !== '') {
        const orGroup = {
            OR: [
                { name: { contains: searchValue } }
            ]
        }
        whereQuery.AND.push(orGroup);
        if (matchedRoleIds.length > 0) {
            orGroup.OR.push({
                roleId: { in: matchedRoleIds }
            });
        }
    }


    return { whereQuery }
}
module.exports = {
    getSearchQuery
};