import { get, set, del } from "idb-keyval";

export const engineDB = {
  async getCars() {
    return (await get("engine_cars")) || [];
  },

  async saveCar(car) {
    const cars = await this.getCars();
    const index = cars.findIndex((c) => c.id === car.id);
    if (index !== -1) {
      cars[index] = car;
    } else {
      cars.push(car);
    }
    await set("engine_cars", cars);
  },

  async deleteCar(id) {
    const cars = await this.getCars();
    const updatedCars = cars.filter((c) => c.id !== id);
    await set("engine_cars", updatedCars);
  },

  async resetDatabase() {
    await del("engine_cars");
  },
};
