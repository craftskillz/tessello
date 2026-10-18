// The Weather View: the cities the User follows, kept in the Host storage under the key "cities" as city ids, and the
// weather of the selected one. Opened with the param { city: "<id>" } (a city of the Widget), it shows that city.
import { connect } from "../tessello-sdk.js";
import { applyTheme, CITIES, cityById, currentWeather, followedCities } from "../weather.js";

const host = await connect();
const list = document.getElementById("cities");
const form = document.getElementById("add-city");
const select = document.getElementById("new-city");
const detail = document.getElementById("detail");

let cities = await followedCities(host);
let selected = cities[0]?.id ?? null;

function element(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function renderCities() {
  list.replaceChildren(
    ...cities.map((city) => {
      const open = element("button", { type: "button", className: "city" }, city.name);
      if (city.id === selected) open.setAttribute("aria-current", "true");
      open.addEventListener("click", () => show(city.id));
      const remove = element("button", { type: "button", className: "remove" }, "×");
      remove.setAttribute("aria-label", `Stop following ${city.name}`);
      remove.addEventListener("click", () => unfollow(city.id));
      return element("li", {}, open, remove);
    }),
  );
  const others = CITIES.filter((city) => !cities.some((followed) => followed.id === city.id));
  select.replaceChildren(...others.map((city) => element("option", { value: city.id }, city.name)));
  form.hidden = others.length === 0;
}

// The latest city asked for: a slower answer for a city left since does not replace it.
let shown = null;
async function renderDetail() {
  const city = cityById(selected);
  shown = city;
  if (!city) {
    detail.replaceChildren(element("p", {}, "Follow a city to see its weather."));
    return;
  }
  detail.replaceChildren(element("h2", {}, city.name), element("p", { className: "muted" }, "Loading…"));
  try {
    const weather = await currentWeather(city);
    if (shown !== city) return;
    detail.replaceChildren(
      element("h2", {}, city.name),
      element("p", { className: "now" }, element("span", { className: "symbol" }, weather.symbol), `${weather.temperature} °C`),
      element("p", {}, weather.label),
      element("p", { className: "muted" }, `Today ${weather.min} °C to ${weather.max} °C · wind ${weather.wind} km/h`),
    );
  } catch (error) {
    if (shown !== city) return;
    console.error(`The weather of ${city.name} could not be loaded:`, error);
    detail.replaceChildren(element("h2", {}, city.name), element("p", { role: "alert" }, "The weather can't be loaded right now."));
  }
}

function show(id) {
  if (!cityById(id)) return;
  // A city of the Widget the User no longer follows is shown all the same.
  selected = id;
  renderCities();
  void renderDetail();
}

async function save(next) {
  await host.storage.set("cities", next.map((city) => city.id));
  cities = next;
}

async function unfollow(id) {
  await save(cities.filter((city) => city.id !== id));
  if (selected === id) selected = cities[0]?.id ?? null;
  renderCities();
  void renderDetail();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const city = cityById(select.value);
  if (!city) return;
  await save([...cities, city]);
  show(city.id);
});

const navigate = (params) => params.city && show(params.city);

applyTheme(host.context.theme);
host.onThemeChange(applyTheme);
host.onNavigationParams(navigate);
renderCities();
if (host.context.params?.city && cityById(host.context.params.city)) navigate(host.context.params);
else void renderDetail();
