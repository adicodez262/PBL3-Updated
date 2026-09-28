

const BANGALORE = [12.9716,77.5946]

const OSRM_SERVICE = "https://router.project-osrm.org/route/v1"

const NOMINATIM =
"https://nominatim.openstreetmap.org/search?format=json&limit=1&q="




const STATIONS = [

{name:"MG Road EV FastCharge",type:"EV",lat:12.9754,lng:77.6059},

{name:"Indiranagar IOCL",type:"Petrol",lat:12.9719,lng:77.6412},

{name:"Koramangala EV Hub",type:"EV",lat:12.9352,lng:77.6245},

{name:"Shell Hosur Road",type:"Petrol",lat:12.9348,lng:77.6242},

{name:"Whitefield EV Charge",type:"EV",lat:12.9695,lng:77.7500},

{name:"Hebbal Indian Oil",type:"Petrol",lat:13.0358,lng:77.5897},

{name:"Yelahanka EV Point",type:"EV",lat:13.1010,lng:77.5960},

{name:"BTM Petrol Pump",type:"Petrol",lat:12.9151,lng:77.6100},

{name:"Electronic City EV Station",type:"EV",lat:12.8399,lng:77.6770},

{name:"Jayanagar Fuel Station",type:"Petrol",lat:12.9299,lng:77.5830},

{name:"Marathahalli EV Charge",type:"EV",lat:12.9560,lng:77.7010},

{name:"Airport Petrol Pump",type:"Petrol",lat:13.1986,lng:77.7066},

{name:"Rajajinagar EV Station",type:"EV",lat:12.9915,lng:77.5540},

{name:"Banashankari Fuel Station",type:"Petrol",lat:12.9250,lng:77.5468}

]




let map
let routeLine
let routeCoords = []
let carMarker

let vehicle = "EV"



const $ = s => document.querySelector(s)

const fuelSlider = $("#fuelLevel")
const fuelLabel = $("#fuelLabel")
const statusChip = $("#status")
const toast = $("#toast")
const toastText = $("#toastText")




function initMap(){

map = L.map("map").setView(BANGALORE,12)

L.tileLayer(
"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
{maxZoom:19}
).addTo(map)

drawStations()

}



function drawStations(){

STATIONS.forEach(s=>{

const icon=L.divIcon({

html:`<div class="${
s.type==="EV"?"marker-ev":"marker-fuel"
}">${s.type==="EV"?"⚡":"⛽"}</div>`,

iconAnchor:[17,17]

})

L.marker([s.lat,s.lng],{icon})
.addTo(map)
.bindPopup(`<b>${s.name}</b><br>${s.type}`)

})

}




document.addEventListener("DOMContentLoaded",()=>{

initMap()

fuelLabel.textContent=fuelSlider.value+"%"

fuelSlider.addEventListener("input",e=>{

fuelLabel.textContent=e.target.value+"%"

})

document.querySelectorAll(".seg-btn").forEach(btn=>{

btn.addEventListener("click",()=>{

document.querySelectorAll(".seg-btn")
.forEach(b=>b.classList.remove("active"))

btn.classList.add("active")

vehicle=btn.dataset.veh

})

})

$("#planBtn").addEventListener("click",planRoute)

})




async function geocode(q){

const url=NOMINATIM+encodeURIComponent(q)

const r=await fetch(url)

const data=await r.json()

if(!data.length) throw "Location not found"

return[
parseFloat(data[0].lat),
parseFloat(data[0].lon)
]

}




function trafficFactor(){

const h=new Date().getHours()

if((h>=8 && h<=10)||(h>=17 && h<=19))
return 1.3

if(h>=22||h<=6)
return 0.9

return 1

}

function routeColor(tf){

return tf>1 ? "#ff0000" : "#2563eb"

}




function computeConsumption(distance,fuel){

const km=distance/1000

if(vehicle==="EV"){

const kwh=km*0.15

return{

text:kwh.toFixed(2)+" kWh",

enough:kwh<(fuel/100)*60

}

}

else{

const liters=km*0.075

return{

text:liters.toFixed(2)+" L",

enough:liters<(fuel/100)*40

}

}

}



function nearestStation(mid){

let best=null

let bestDist=Infinity

STATIONS.forEach(s=>{

if(s.type!==vehicle) return

const d=map.distance(mid,[s.lat,s.lng])

if(d<bestDist){

bestDist=d
best=s

}

})

return best

}



async function fetchRoute(a,b){

const url=
`${OSRM_SERVICE}/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`

const r=await fetch(url)

const j=await r.json()

return j.routes[0]

}




function animateCar(coords){

if(carMarker) carMarker.remove()

const icon=L.divIcon({
html:`<div class="car">🚗</div>`,
iconAnchor:[15,15]
})

carMarker=L.marker(coords[0],{icon}).addTo(map)

let i=0

const timer=setInterval(()=>{

i++

if(i>=coords.length){

clearInterval(timer)
return

}

carMarker.setLatLng(coords[i])

},30)

}



async function planRoute(){

try{

const src=$("#source").value.trim()

const stop=$("#stop").value.trim()

const dst=$("#destination").value.trim()

const fuel=parseInt(fuelSlider.value)

const A=await geocode(src)

const B=await geocode(dst)

let segments=[]

if(stop){

const S=await geocode(stop)

segments.push(await fetchRoute(A,S))

segments.push(await fetchRoute(S,B))

}else{

segments.push(await fetchRoute(A,B))

}

let dist=0
let time=0

routeCoords=[]

segments.forEach(r=>{

dist+=r.distance
time+=r.duration

routeCoords=routeCoords.concat(
r.geometry.coordinates.map(c=>[c[1],c[0]])
)

})

const tf=trafficFactor()

const color=routeColor(tf)

if(routeLine) map.removeLayer(routeLine)

routeLine=L.polyline(routeCoords,{
color,
weight:7
}).addTo(map)

map.fitBounds(routeLine.getBounds())

animateCar(routeCoords)

const cons=computeConsumption(dist,fuel)

$("#dist").textContent=(dist/1000).toFixed(2)+" km"

$("#eta").textContent=
Math.round((time*tf)/60)+" min"

$("#consumption").textContent=cons.text


if(!cons.enough){

const mid=
routeCoords[Math.floor(routeCoords.length/2)]

const station=nearestStation(mid)

if(station){

toastText.textContent=station.name

toast.classList.remove("hidden")

const S=[station.lat,station.lng]

const r1=await fetchRoute(A,S)

const r2=await fetchRoute(S,B)

routeCoords=
r1.geometry.coordinates.map(c=>[c[1],c[0]])
.concat(
r2.geometry.coordinates.map(c=>[c[1],c[0]])
)

routeLine.setLatLngs(routeCoords)

}

statusChip.innerHTML="<span>Stop Needed</span>"

}

else{

statusChip.innerHTML="<span>Enough</span>"

}

}catch(err){

console.error(err)

statusChip.innerHTML="<span>Error</span>"

}

}