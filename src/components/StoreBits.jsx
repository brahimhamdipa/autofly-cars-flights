// Stock line, exactly like the Online Store page: green when in stock,
// red when out of stock, nothing at all when stock is not tracked
// (null — e.g. services).
export function StockLine({ stock }) {
  if (stock === null || stock === undefined) return null
  if (stock <= 0) return <p className="stock out">Out of stock</p>
  if (stock <= 10) return <p className="stock low">Only {stock} left in stock</p>
  return <p className="stock ok">{stock} available in stock</p>
}
