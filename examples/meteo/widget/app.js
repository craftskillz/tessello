// The Weather Widget: the current temperature of the first cities the User follows. Each city opens the View on it.
import { connect } from "../tessello-sdk.js";
import { applyTheme, currentWeather, followedCities } from "../weather.js";

const host = await connect();
const list = document.getElementById("cities");

// The View chooses the cities: they are read again each time the Widget is shown, since the Host does not push them.
async function render() {
  const cities = (await followedCities(host)).slice(0, 3);
  const items = await Promise.all(
    cities.map(async (city) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", `Open the weather of ${city.name}`);
      button.addEventListener("click", () => host.openView({ city: city.id }));
      const name = Object.assign(document.createElement("span"), { className: "name", textContent: city.name });
      const now = Object.assign(document.createElement("span"), { className: "now" });
      try {
        const weather = await currentWeather(city);
        now.textContent = `${weather.symbol} ${weather.temperature} °C`;
        now.title = weather.label;
      } catch (error) {
        console.error(`The weather of ${city.name} could not be loaded:`, error);
        now.textContent = "–";
      }
      button.append(name, now);
      const item = document.createElement("li");
      item.append(button);
      return item;
    }),
  );
  list.replaceChildren(...items);
  if (items.length === 0) list.append(Object.assign(document.createElement("li"), { className: "empty", textContent: "No city followed" }));
}

host.onVisibilityChange((visible) => visible && render());
applyTheme(host.context.theme);
host.onThemeChange(applyTheme);
await render();
