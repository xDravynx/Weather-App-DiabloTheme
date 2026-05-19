(() => {
  // DOM Elements
  const form = document.querySelector("form");
  const input = document.getElementById("cityInput");

  const cityName = document.getElementById("cityName");
  const temp = document.getElementById("temp");
  const desc = document.getElementById("desc");
  const icon = document.getElementById("weatherIcon");

  const humidity = document.getElementById("humidity");
  const wind = document.getElementById("wind");
  const feels = document.getElementById("feels");

  const forecastDiv = document.getElementById("forecast-cards");

  const apiKey = "zpka_4c13dce2aa194945859027b567b7d33c_8000ae50";

  // Error + Loading
  const errorMsg = document.createElement("p");
  errorMsg.style.color = "red";
  errorMsg.style.fontWeight = "bold";
  errorMsg.style.display = "none";
  errorMsg.textContent = "City not found";
  form.after(errorMsg);

  const spinner = document.createElement("p");
  spinner.textContent = "Loading....";
  spinner.style.display = "none";
  spinner.style.fontWeight = "bold";
  form.after(spinner);

  function saveLastSearch(query) {
    localStorage.setItem("lastSearch", query);
  }

  window.addEventListener("load", () => {
    const last = localStorage.getItem("lastSearch");
    if (last) {
      input.value = last;
      fetchWeather(last).then((data) => {
        if (data) {
          updateUI(data);
          fetchForecast(data.locationKey).then(renderForecast);
        }
      });
    }
  });

  form.addEventListener("submit", handleSearch);

  function handleSearch(e) {
    e.preventDefault();

    const query = input.value.trim();
    if (!query) return;

    errorMsg.style.display = "none";
    spinner.style.display = "block";

    fetchWeather(query)
      .then((data) => {
        spinner.style.display = "none";
        if (!data) {
          errorMsg.style.display = "block";
          return;
        }
        updateUI(data);
        fetchForecast(data.locationKey).then(renderForecast);
      })
      .catch(() => {
        spinner.style.display = "none";
        errorMsg.style.display = "block";
      });

    saveLastSearch(query);
  }

  // Fetch Weather
  function fetchWeather(query) {
    const cleanQuery = query.replace(/\s+/g, "");
    const isZip = /^\d{5}$/.test(cleanQuery);

    const locationURL = isZip
      ? `https://dataservice.accuweather.com/locations/v1/postalcodes/search?apikey=${apiKey}&q=${query}`
      : `https://dataservice.accuweather.com/locations/v1/cities/search?apikey=${apiKey}&q=${query}`;

    return fetch(locationURL)
      .then((res) => res.json())
      .then((locations) => {
        if (!locations || locations.length === 0) return null;

        const locationKey = locations[0].Key;
        const cityName = locations[0].LocalizedName;

        return fetch(
          `https://dataservice.accuweather.com/currentconditions/v1/${locationKey}?apikey=${apiKey}&details=true`,
        )
          .then((res) => res.json())
          .then((weather) => {
            if (!weather || weather.length === 0) return null;

            return {
              locationKey,
              name: cityName,
              temp: weather[0].Temperature.Imperial.Value,
              desc: weather[0].WeatherText,
              icon: weather[0].WeatherIcon,
              humidity: weather[0].RelativeHumidity,
              wind: weather[0].Wind.Speed.Imperial.Value,
              feels: weather[0].RealFeelTemperature.Imperial.Value,
              lat: locations[0].GeoPosition.Latitude,
              lon: locations[0].GeoPosition.Longitude,
            };
          });
      });
  }

  // Fetch Forecast
  function fetchForecast(locationKey) {
    return fetch(
      `https://dataservice.accuweather.com/forecasts/v1/daily/5day/${locationKey}?apikey=${apiKey}&metric=false`,
    )
      .then((res) => res.json())
      .then((data) => data.DailyForecasts);
  }

  // Render Forecast
  function renderForecast(days) {
    forecastDiv.innerHTML = "";

    days.forEach((day) => {
      const date = new Date(day.Date).toLocaleDateString("en-US", {
        weekday: "short",
      });

      const iconNum = String(day.Day.Icon).padStart(2, "0");

      const card = document.createElement("div");
      card.className = "forecast-card";
      card.innerHTML = `
        <h4>${date}</h4>
        <img src="https://www.accuweather.com/images/weathericons/${iconNum}.svg">
        <p>${day.Day.IconPhrase}</p>
        <p>High: ${day.Temperature.Maximum.Value}°F</p>
        <p>Low: ${day.Temperature.Minimum.Value}°F</p>
      `;

      forecastDiv.appendChild(card);
    });
  }

  // Background Theme
  function setBackground(desc) {
    desc = desc.toLowerCase();

    if (desc.includes("sun")) {
      document.body.style.background =
        "linear-gradient(180deg, #3a0000, #0b0b0b)";
    } else if (desc.includes("cloud")) {
      document.body.style.background =
        "linear-gradient(180deg, #1a1a1a, #0b0b0b)";
    } else if (desc.includes("rain")) {
      document.body.style.background =
        "linear-gradient(180deg, #2e2e2e, #0b0b0b)";
    } else if (desc.includes("storm")) {
      document.body.style.background =
        "linear-gradient(180deg, #000000, #3a0000)";
    } else if (desc.includes("snow")) {
      document.body.style.background = "linear-gradient(180deg, #444, #0b0b0b)";
    } else {
      document.body.style.background =
        "linear-gradient(180deg, #1a1a1a, #0b0b0b)";
    }
  }

  // Update UI
  function updateUI(data) {
    cityName.textContent = data.name;
    temp.textContent = `${data.temp}°F`;
    desc.textContent = data.desc;

    icon.src = `https://www.accuweather.com/images/weathericons/${String(
      data.icon,
    ).padStart(2, "0")}.svg`;

    humidity.textContent = `${data.humidity}%`;
    wind.textContent = `${data.wind} MPH`;
    feels.textContent = `${data.feels}°F`;

    setBackground(data.desc);

    map.setView([data.lat, data.lon], 10);
  }

  // Map
  let map = L.map("windy").setView([32.4487, -99.7331], 10);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
  }).addTo(map);

  // -----------------------------
  // MRMS HYBRID RADAR (n0q + n0u)
  // -----------------------------

  let radarFrames = [];
  let currentFrameIndex = 0;
  let radarTimer = null;

  // Diablo Storm Colorizer
  function applyStormColorizer(layer) {
    const el = layer.getContainer();
    if (!el) return;

    el.style.filter = `
      brightness(1.2)
      saturate(2.5)
      hue-rotate(-30deg)
      contrast(1.4)
    `;
  }

  // Fetch MRMS timestamps (correct endpoint)
  function fetchMRMSTimestamps(callback) {
    fetch("https://mesonet.agron.iastate.edu/json/mrms/n0q.json.php")
      .then((res) => res.json())
      .then((data) => callback(data.timestamps))
      .catch(() => callback([]));
  }

  function buildRadarFrames() {
    radarFrames.forEach((frame) => {
      map.removeLayer(frame.baseLayer);
      map.removeLayer(frame.coreLayer);
    });
    radarFrames = [];

    fetchMRMSTimestamps(function (timestamps) {
      timestamps.forEach((ts) => {
        // Base reflectivity (n0q)
        const baseLayer = L.tileLayer(
          `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/mrms/n0q/${ts}/{z}/{x}/{y}.png`,
          {
            tileSize: 256,
            opacity: 0,
            zIndex: 10,
          },
        );

        // High‑res dual‑pol (n0u)
        const coreLayer = L.tileLayer(
          `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/mrms/n0u/${ts}/{z}/{x}/{y}.png`,
          {
            tileSize: 256,
            opacity: 0,
            zIndex: 11,
          },
        );

        baseLayer.on("load", () => applyStormColorizer(baseLayer));
        coreLayer.on("load", () => applyStormColorizer(coreLayer));

        radarFrames.push({ baseLayer, coreLayer });

        baseLayer.addTo(map);
        coreLayer.addTo(map);
      });

      currentFrameIndex = radarFrames.length - 1;
      showRadarFrame(currentFrameIndex);
    });
  }

  function showRadarFrame(index) {
    radarFrames.forEach((frame, i) => {
      const visible = i === index ? 0.75 : 0;
      frame.baseLayer.setOpacity(visible);
      frame.coreLayer.setOpacity(visible);
    });
  }

  function stepRadarFrame() {
    if (radarFrames.length === 0) return;

    currentFrameIndex = (currentFrameIndex + 1) % radarFrames.length;
    showRadarFrame(currentFrameIndex);
    pulseRadar();
  }

  function startRadarAnimation() {
    if (radarTimer) clearInterval(radarTimer);
    radarTimer = setInterval(stepRadarFrame, 800);
  }

  function refreshRadarFrames() {
    buildRadarFrames();
  }

  buildRadarFrames();
  startRadarAnimation();

  // Auto-refresh every 5 minutes
  setInterval(refreshRadarFrames, 300000);

  // Diablo Pulse
  function pulseRadar() {
    const windy = document.getElementById("windy");
    windy.style.boxShadow = "0 0 25px #c41e3a";
    setTimeout(() => (windy.style.boxShadow = ""), 300);
  }
})();
