// ?page=1&limit=10 (limit capped at 100)
function getPage(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

const meta = (page, limit, total) => ({ page, limit, total, pages: Math.ceil(total / limit) });

module.exports = { getPage, meta };
