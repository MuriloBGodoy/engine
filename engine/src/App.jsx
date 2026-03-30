import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./services/firebase";
import { engineDB } from "./services/db";
import "./index.css";

import { Sidebar } from "./components/Sidebar";
import { ModalNewCar } from "./components/ModalNewCar";
import { DeleteModal } from "./components/DeleteModal";
import { Home } from "./pages/Home";
import { Garagem } from "./pages/Garagem";
import { DashboardPage } from "./pages/DashboardPage";

import { Login } from "./pages/Login";
import { Register } from "./pages/Register";

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dbLoading, setDbLoading] = useState(true);
  const [cars, setCars] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [carToEdit, setCarToEdit] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [carToDelete, setCarToDelete] = useState(null);
  const [deleteMessage, setDeleteMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      (async () => {
        try {
          const savedCars = await engineDB.getCars();
          setCars(savedCars);
        } catch (error) {
          console.error(error);
        } finally {
          setDbLoading(false);
        }
      })();
    } else {
      setDbLoading(false);
    }
  }, [user]);

  const handleOpenModal = (car = null) => {
    setCarToEdit(car);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCarToEdit(null);
  };

  const saveCarAction = async (carData) => {
    try {
      await engineDB.saveCar(carData);
      const updatedCars = await engineDB.getCars();
      setCars(updatedCars);
      handleCloseModal();
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  const openDeleteConfirmation = (car) => {
    const percentage = (car.savedValue / car.targetValue) * 100;
    let msg = `Tem certeza que deseja desistir do seu sonho (${car.brand} ${car.model})? Você já conquistou ${percentage.toFixed(0)}%! Bora continuar? 🚀`;
    setCarToDelete(car);
    setDeleteMessage(msg);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (carToDelete) {
      await engineDB.deleteCar(carToDelete.id);
      const updatedCars = await engineDB.getCars();
      setCars(updatedCars);
      setIsDeleteModalOpen(false);
      setCarToDelete(null);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-[#080808]" />;
  }

  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div className="flex bg-[#080808] min-h-screen text-white font-sans overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-10 h-screen">
          {dbLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500 italic">
              Aqueça os motores...
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<Home />} />
              <Route
                path="/garagem"
                element={
                  <Garagem
                    cars={cars}
                    onOpenModal={handleOpenModal}
                    onOpenDelete={openDeleteConfirmation}
                  />
                }
              />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          )}
        </main>

        <ModalNewCar
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={saveCarAction}
          carToEdit={carToEdit}
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
