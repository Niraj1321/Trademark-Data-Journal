import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, Legend 
} from 'recharts'
import { BarChart3, PieChart as PieIcon, ListFilter, ArrowUpRight } from 'lucide-react'

// NICE Classification Reference Map for human readability
const CLASS_DESCRIPTIONS = {
  1: 'Chemicals & Plastics',
  2: 'Paints & Anti-Corrosives',
  3: 'Cosmetics & Cleaning Supplies',
  4: 'Industrial Oils & Fuels',
  5: 'Pharmaceuticals & Medical Supplies',
  6: 'Common Metals & Hardware',
  7: 'Machines & Power Tools',
  8: 'Hand Tools & Cutlery',
  9: 'Software, Electronics & Scientific Devices',
  10: 'Medical & Dental Apparatus',
  11: 'Heating, Lighting & Plumbing',
  12: 'Vehicles & Automotive Parts',
  13: 'Firearms & Explosives',
  14: 'Jewelry & Watches',
  15: 'Musical Instruments',
  16: 'Paper, Printed Goods & Office Items',
  17: 'Rubber, Plastics & Insulation',
  18: 'Leather Goods & Luggage',
  19: 'Non-Metallic Building Materials',
  20: 'Furniture & Household Decor',
  21: 'Housewares & Glassware',
  22: 'Ropes, Cordage & Canvas',
  23: 'Yarns & Threads',
  24: 'Textiles & Fabric Goods',
  25: 'Clothing, Footwear & Headwear',
  26: 'Lace, Ribbons & Embroidery',
  27: 'Carpets, Rugs & Matting',
  28: 'Games, Toys & Sporting Goods',
  29: 'Meat, Dairy & Processed Foods',
  30: 'Staple Foods, Coffee & Spices',
  31: 'Agricultural Products & Seeds',
  32: 'Beers & Non-Alcoholic Beverages',
  33: 'Alcoholic Beverages',
  34: 'Tobacco & Smoker Articles',
  35: 'Advertising, Retail & Business Services',
  36: 'Financial, Real Estate & Insurance Services',
  37: 'Construction & Repair Services',
  38: 'Telecommunications Services',
  39: 'Transport, Shipping & Storage Services',
  40: 'Treatment of Materials Services',
  41: 'Education, Entertainment & Sporting Activities',
  42: 'IT, Software & Scientific R&D Services',
  43: 'Hotels, Restaurants & Catering Services',
  44: 'Medical, Hygiene & Beauty Services',
  45: 'Legal & Personal Security Services',
  99: 'International Registrations (Madrid Protocol)'
}

const BAR_COLORS = [
  '#4f46e5', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4',
  '#14b8a6', '#10b981', '#84cc16', '#eab308', '#f59e0b'
]

export default function ClassDistributionChart({ classDistribution = [], totalTrademarks = 1 }) {
  const navigate = useNavigate()
  const [chartType, setChartType] = useState('bar') // 'bar' | 'pie' | 'list'
  const [viewCount, setViewCount] = useState(10) // 10 | 20 | 0 (all)

  if (!classDistribution || classDistribution.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-400">
        No class distribution data available.
      </div>
    )
  }

  // Sort classes by count descending
  const sortedClasses = [...classDistribution]
    .sort((a, b) => b.count - a.count)
    .map(item => ({
      ...item,
      className: `Class ${item.class}`,
      classTag: `Cls ${item.class}`,
      description: CLASS_DESCRIPTIONS[item.class] || `Class ${item.class}`,
      percentage: totalTrademarks > 0 ? ((item.count / totalTrademarks) * 100).toFixed(1) : 0
    }))

  const displayData = viewCount > 0 ? sortedClasses.slice(0, viewCount) : sortedClasses

  // Category breakdown for Pie Chart
  const goodsCount = sortedClasses.filter(c => c.class >= 1 && c.class <= 34).reduce((sum, c) => sum + c.count, 0)
  const servicesCount = sortedClasses.filter(c => c.class >= 35 && c.class <= 45).reduce((sum, c) => sum + c.count, 0)
  const noticeCount = sortedClasses.filter(c => c.class === 99).reduce((sum, c) => sum + c.count, 0)

  const pieData = [
    { name: 'Goods Classes (1 - 34)', value: goodsCount, color: '#3b82f6' },
    { name: 'Services Classes (35 - 45)', value: servicesCount, color: '#6366f1' },
    { name: 'International Notices (Class 99)', value: noticeCount, color: '#f59e0b' },
  ].filter(d => d.value > 0)

  // Custom Tooltip for Bar Chart
  const CustomBarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700 max-w-xs z-50">
          <div className="font-extrabold text-primary-400 flex items-center justify-between gap-2">
            <span>Class {data.class}</span>
            <span className="badge badge-info text-[10px]">{data.percentage}% Share</span>
          </div>
          <p className="font-bold text-slate-100">{data.description}</p>
          <p className="text-slate-300">
            Total Filings: <strong className="text-white">{data.count.toLocaleString()}</strong>
          </p>
          <p className="text-[10px] text-primary-300 italic pt-1 border-t border-slate-800">
            💡 Click bar to filter trademarks by Class {data.class}
          </p>
        </div>
      )
    }
    return null
  }

  // Handle bar click to navigate
  const handleBarClick = (entry) => {
    if (entry && entry.class) {
      navigate(`/trademarks?class_number=${entry.class}`)
    }
  }

  // Calculate inner width for 46 classes so bars and labels stay perfectly readable
  const minWidth = displayData.length > 20 ? '1350px' : displayData.length > 10 ? '750px' : '100%'

  return (
    <div className="space-y-4">
      {/* Chart Control Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-slate-100 gap-3">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Trademark Class Distribution</h3>
            <p className="text-xs text-slate-500">Filings volume across goods, services & international notice classes</p>
          </div>
        </div>

        {/* View Switchers */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Top 10 / 20 / All Selector */}
          <select
            value={viewCount}
            onChange={(e) => setViewCount(Number(e.target.value))}
            className="bg-slate-100 border border-slate-200 text-slate-800 rounded-lg text-xs font-semibold py-1.5 px-2 focus:ring-2 focus:ring-primary-500 cursor-pointer shadow-xs"
          >
            <option value={10}>Top 10 Classes</option>
            <option value={20}>Top 20 Classes</option>
            <option value={0}>All {sortedClasses.length} Classes</option>
          </select>

          {/* Chart Type Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setChartType('bar')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg transition-all ${
                chartType === 'bar' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Vertical Column Bar View"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Bar Chart</span>
            </button>
            <button
              onClick={() => setChartType('pie')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg transition-all ${
                chartType === 'pie' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Category Donut View"
            >
              <PieIcon className="h-3.5 w-3.5" />
              <span>Pie</span>
            </button>
            <button
              onClick={() => setChartType('list')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg transition-all ${
                chartType === 'list' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Ranked List View"
            >
              <ListFilter className="h-3.5 w-3.5" />
              <span>List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Render Chart View */}
      {chartType === 'bar' && (
        <div className="space-y-2">
          {/* Horizontal Scroll Wrapper to ensure bars and tilted labels NEVER collide */}
          <div className="overflow-x-auto pb-2 border border-slate-100 rounded-2xl bg-slate-50/40 p-3">
            <div style={{ minWidth, height: '340px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={displayData} 
                  margin={{ top: 15, right: 20, left: -15, bottom: 45 }}
                >
                  <XAxis 
                    dataKey="class" 
                    tickFormatter={(val) => `Cls ${val}`}
                    tick={{ fontSize: 10, fill: '#334155', fontWeight: 700 }}
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar 
                    dataKey="count" 
                    radius={[6, 6, 0, 0]}
                    cursor="pointer"
                    onClick={handleBarClick}
                  >
                    {displayData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={BAR_COLORS[index % BAR_COLORS.length]} 
                        className="hover:opacity-85 transition-opacity"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <p className="text-[11px] text-center text-slate-500 font-medium">
            💡 Click on any bar column to filter registered trademarks. Hover over columns to see full class descriptions.
          </p>
        </div>
      )}

      {chartType === 'pie' && (
        <div className="h-80 w-full flex flex-col items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={4}
                dataKey="value"
                label={({ name, percent }) => `${name.split(' ')[0]} (${(percent * 100).toFixed(0)}%)`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value.toLocaleString()} Trademarks`, 'Filings']} />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {chartType === 'list' && (
        <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
          {displayData.map((item, index) => (
            <button
              key={item.class}
              onClick={() => handleBarClick(item)}
              className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/80 transition-all group flex items-center justify-between"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <span className="w-6 h-6 rounded-lg bg-primary-100 text-primary-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                  #{index + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-xs text-slate-900 group-hover:text-primary-700 transition-colors">
                      Class {item.class}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 truncate">
                      — {item.description}
                    </span>
                  </div>
                  <div className="w-48 sm:w-64 h-1.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                    <div 
                      className="h-full bg-primary-600 rounded-full" 
                      style={{ width: `${Math.max(item.percentage, 3)}%` }} 
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 text-right shrink-0">
                <div>
                  <p className="text-xs font-extrabold text-slate-900">{item.count.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-primary-600">{item.percentage}% share</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-primary-600 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
