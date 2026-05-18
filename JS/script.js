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

  const apiKey = "zpka_503affde7f394846be0ea625e699509f_5ac39e1e";

  // Create error + loading elements
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
  // Save last search (Auto-load on refresh)

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

  // Event Listener
  form.addEventListener("submit", handleSearch);

  // Main Handler
  function handleSearch(e) {
    e.preventDefault();

    const query = input.value.trim();
    if (!query) return;

    //Reset UI
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

  // Fetch function
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

  // Fetch 5-day Forecast
  function fetchForecast(locationKey) {
    return fetch(
      `https://dataservice.accuweather.com/forecasts/v1/daily/5day/${locationKey}?apikey=${apiKey}&metric=false`,
    )
      .then((res) => res.json())
      .then((data) => data.DailyForecasts);
  }

  // Render 5-day Forecast
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
  //Update UI
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

    loadNOAARadar();
  }

  // Create Map

  let map = L.map("windy").setView([32.4487, -99.7331], 7);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
  }).addTo(map);

  let noaaLayer = null;

  function loadNOAARadar() {
    if (noaaLayer) {
      map.removeLayer(noaaLayer);
    }

    noaaLayer = L.tileLayer(
      "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q/{z}/{x}/{y}.png",
      {
        tileSize: 256,
        opacity: 0.6,
        zIndex: 10,
      },
    );

    noaaLayer.addTo(map);
  }
})();
