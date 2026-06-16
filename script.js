script.js
let map = L.map('map').setView([43.2389, 76.8897], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

let clientMarker;
let driverMarker;

// 📍 клиент
function getClientLocation() {
  navigator.geolocation.getCurrentPosition((pos) => {
    let lat = pos.coords.latitude;
    let lon = pos.coords.longitude;

    if (clientMarker) map.removeLayer(clientMarker);

    clientMarker = L.marker([lat, lon])
      .addTo(map)
      .bindPopup("Вы (клиент)")
      .openPopup();

    map.setView([lat, lon], 13);
  });
}

// 🚚 эвакуатор
function setDriverLocation() {
  navigator.geolocation.getCurrentPosition((pos) => {
    let lat = pos.coords.latitude;
    let lon = pos.coords.longitude;

    if (driverMarker) map.removeLayer(driverMarker);

    driverMarker = L.marker([lat, lon])
      .addTo(map)
      .bindPopup("Эвакуатор")
      .openPopup();

    map.setView([lat, lon], 13);
  });
}

// 🚨 заявка
function sendRequest() {
  alert("Заявка отправлена! Мы вам перезвоним и договоримся по цене.");
}