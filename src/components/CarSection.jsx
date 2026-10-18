import { useState } from 'react'
import { submitAndNotify } from '../lib/notify'

const SAMPLE_CARS = [
  { id: 1, make: 'Toyota', model: 'Camry', year: 2021, price: 21900, mileage: 32000, image: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=600&q=80', tag: 'Great value' },
  { id: 2, make: 'Honda', model: 'Civic', year: 2022, price: 23500, mileage: 18000, image: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=600&q=80', tag: 'Low miles' },
  { id: 3, make: 'Tesla', model: 'Model 3', year: 2023, price: 32900, mileage: 12000, image: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=600&q=80', tag: 'Electric' },
  { id: 4, make: 'Ford', model: 'Mustang', year: 2020, price: 28900, mileage: 28000, image: 'https://images.unsplash.com/photo-1584345604476-8ec5e12e42dd?w=600&q=80', tag: 'Sport' },
  { id: 5, make: 'BMW', model: '3 Series', year: 2021, price: 31500, mileage: 25000, image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=600&q=80', tag: 'Premium' },
  { id: 6, make: 'Jeep', model: 'Wrangler', year: 2019, price: 27400, mileage: 41000, image: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600&q=80', tag: '4x4' },
]

export default function CarSection() {
  const [filterMake, setFilterMake] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sellForm, setSellForm] = useState({ make: '', model: '', year: '', mileage: '', condition: 'Good', vin: '', name: '', email: '', phone: '' })
  const [buyForm, setBuyForm] = useState({ car_id: '', name: '', email: '', phone: '', message: '' })
  const [status, setStatus] = useState('')

  const filtered = SAMPLE_CARS.filter(c => {
    if (filterMake && !`${c.make} ${c.model}`.toLowerCase().includes(filterMake.toLowerCase())) return false
    if (maxPrice && c.price > Number(maxPrice)) return false
    return true
  })

  const handleSell = async (e) => {
    e.preventDefault()
    setStatus('Sending your sell request...')
    try {
      await submitAndNotify({
        table: 'car_sell_requests',
        data: { ...sellForm, year: Number(sellForm.year), mileage: Number(sellForm.mileage) },
        subject: `New car sell request: ${sellForm.make} ${sellForm.model}`,
      })
      setStatus('✓ Sell request sent! We will email you shortly.')
      setSellForm({ make: '', model: '', year: '', mileage: '', condition: 'Good', vin: '', name: '', email: '', phone: '' })
    } catch (err) {
      setStatus('Error: ' + err.message + ' (check Supabase .env)')
    }
  }

  const handleBuy = async (e) => {
    e.preventDefault()
    setStatus('Sending your inquiry...')
    try {
      await submitAndNotify({
        table: 'car_inquiries',
        data: { ...buyForm, car_id: Number(buyForm.car_id) },
        subject: `New car inquiry for car #${buyForm.car_id}`,
      })
      setStatus('✓ Inquiry sent! The seller will contact you.')
      setBuyForm({ car_id: '', name: '', email: '', phone: '', message: '' })
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
  }

  return (
    <div>
      <div className="hero-card">
        <h2>Buy your next car, fully online</h2>
        <p>Browse verified cars like Carvana — 150-point inspection, history report, 7-day return. Or sell us your car with an instant offer.</p>
        <div className="filters">
          <input placeholder="Search make or model (e.g. Toyota)" value={filterMake} onChange={e => setFilterMake(e.target.value)} />
          <input placeholder="Max price ($)" type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
        </div>
      </div>

      <div className="grid">
        {filtered.map(car => (
          <div key={car.id} className="card">
            <img src={car.image} alt={`${car.make} ${car.model}`} />
            <div className="card-body">
              <span className="tag">{car.tag}</span>
              <h3>{car.year} {car.make} {car.model}</h3>
              <p>{car.mileage.toLocaleString()} miles</p>
              <p className="price">${car.price.toLocaleString()}</p>
              <button onClick={() => setBuyForm(f => ({ ...f, car_id: String(car.id), message: `I'm interested in the ${car.year} ${car.make} ${car.model}` }))}>I'm interested</button>
            </div>
          </div>
        ))}
      </div>

      <div className="two-col">
        <form className="form-card" onSubmit={handleSell}>
          <h3>Sell your car — get an instant offer</h3>
          <div className="row">
            <input required placeholder="Make (e.g. Honda)" value={sellForm.make} onChange={e => setSellForm({ ...sellForm, make: e.target.value })} />
            <input required placeholder="Model (e.g. Accord)" value={sellForm.model} onChange={e => setSellForm({ ...sellForm, model: e.target.value })} />
          </div>
          <div className="row">
            <input required placeholder="Year" type="number" value={sellForm.year} onChange={e => setSellForm({ ...sellForm, year: e.target.value })} />
            <input required placeholder="Mileage" type="number" value={sellForm.mileage} onChange={e => setSellForm({ ...sellForm, mileage: e.target.value })} />
          </div>
          <div className="row">
            <select value={sellForm.condition} onChange={e => setSellForm({ ...sellForm, condition: e.target.value })}>
              <option>Excellent</option><option>Good</option><option>Fair</option><option>Poor</option>
            </select>
            <input placeholder="VIN (optional)" value={sellForm.vin} onChange={e => setSellForm({ ...sellForm, vin: e.target.value })} />
          </div>
          <div className="row">
            <input required placeholder="Your name" value={sellForm.name} onChange={e => setSellForm({ ...sellForm, name: e.target.value })} />
            <input required placeholder="Email" type="email" value={sellForm.email} onChange={e => setSellForm({ ...sellForm, email: e.target.value })} />
          </div>
          <input placeholder="Phone" value={sellForm.phone} onChange={e => setSellForm({ ...sellForm, phone: e.target.value })} />
          <button type="submit">Get instant offer</button>
        </form>

        <form className="form-card" onSubmit={handleBuy}>
          <h3>Request a car / test drive</h3>
          <select required value={buyForm.car_id} onChange={e => setBuyForm({ ...buyForm, car_id: e.target.value })}>
            <option value="">Select a car</option>
            {SAMPLE_CARS.map(c => <option key={c.id} value={c.id}>{c.year} {c.make} {c.model} — ${c.price.toLocaleString()}</option>)}
          </select>
          <div className="row">
            <input required placeholder="Your name" value={buyForm.name} onChange={e => setBuyForm({ ...buyForm, name: e.target.value })} />
            <input required placeholder="Email" type="email" value={buyForm.email} onChange={e => setBuyForm({ ...buyForm, email: e.target.value })} />
          </div>
          <input placeholder="Phone" value={buyForm.phone} onChange={e => setBuyForm({ ...buyForm, phone: e.target.value })} />
          <textarea placeholder="Message" value={buyForm.message} onChange={e => setBuyForm({ ...buyForm, message: e.target.value })} />
          <button type="submit">Send inquiry</button>
        </form>
      </div>
      {status && <p className="status">{status}</p>}
    </div>
  )
}
