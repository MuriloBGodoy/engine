import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";

import { Sidebar } from "./components/Sidebar";
import { ModalNewCar } from "./components/ModalNewCar";
import { DeleteModal } from "./components/DeleteModal";

import { Home } from "./pages/Home";
import { Garagem } from "./pages/Garagem";
import { DashboardPage } from "./pages/DashboardPage";

import { engineDB } from "./services/db";

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [carToDelete, setCarToDelete] = useState(null);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        // Busca carros do IndexedDB
        const savedCars = await engineDB.getCars();
        setCars(savedCars);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const addCar = (newCar) => {
    const updatedCars = [...cars, newCar];
    setCars(updatedCars);
    engineDB.saveCars(updatedCars);
  };

  const openDeleteConfirmation = (car) => {
    const percentage = (car.savedValue / car.targetValue) * 100;
    let msg = `Tem certeza que deseja desistir do seu sonho (${car.brand} ${car.model})? Você já conquistou ${percentage.toFixed(0)}%! Bora continuar? 🚀`;

    setCarToDelete(car);
    setDeleteMessage(msg);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (carToDelete) {
      const updatedCars = cars.filter((c) => c.id !== carToDelete.id);
      setCars(updatedCars);
      engineDB.saveCars(updatedCars);
      setIsDeleteModalOpen(false);
      setCarToDelete(null);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#121212]"></div>;

  return (
    <BrowserRouter>
      <div className="flex bg-[#121212] min-h-screen text-white font-sans overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto p-10 h-screen">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/garagem"
              element={
                <Garagem
                  cars={cars}
                  onOpenModal={() => setIsModalOpen(true)}
                  onOpenDelete={openDeleteConfirmation}
                />
              }
            />

            <Route path="/dashboard" element={<DashboardPage />} />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>

        <ModalNewCar
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={addCar}
        />

        <DeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={confirmDelete}
          message={deleteMessage}
          carName={
            carToDelete ? `${carToDelete.brand} ${carToDelete.model}` : ""
          }
        />
      </div>
    </BrowserRouter>
  );
}

export default App;
