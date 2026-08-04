import { useState, useRef } from 'react';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, firestore, storage } from '../services/firebase';
import { countries, getStates } from '../services/locations';

export function EditProfileModal({ isOpen, onClose, onSave, profileSettings = {} }) {
  const user = auth.currentUser;

  const [formData, setFormData] = useState({
    displayName: profileSettings?.displayName || profileSettings?.profile?.displayName || user?.displayName || '',
    username: profileSettings?.username || profileSettings?.profile?.username || '',
    bio: profileSettings?.bio || profileSettings?.profile?.bio || '',
    phoneCountry: profileSettings?.phoneCountry || profileSettings?.profile?.phoneCountry || '+55',
    phone: profileSettings?.phone || profileSettings?.profile?.phone || '',
    country: profileSettings?.country || profileSettings?.profile?.country || 'BR',
    state: profileSettings?.state || profileSettings?.profile?.state || '',
    city: profileSettings?.city || profileSettings?.profile?.city || '',
  });

  const [preview, setPreview] = useState({
    avatar: profileSettings?.avatar || profileSettings?.profile?.avatar || null,
    banner: profileSettings?.bannerURL || profileSettings?.profile?.bannerURL || null,
  });

  const [files, setFiles] = useState({
    avatar: null,
    banner: null,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [bioCharCount, setBioCharCount] = useState(formData.bio.length);

  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  const countryObj = countries.find(c => c.code === formData.country);
  const stateOptions = countryObj ? getStates(formData.country) : [];
  const cityOptions = stateOptions.find(s => s.code === formData.state)?.cities || [];

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleCountryChange = (value) => {
    handleFieldChange('country', value);
    handleFieldChange('state', '');
    handleFieldChange('city', '');
  };

  const handleStateChange = (value) => {
    handleFieldChange('state', value);
    handleFieldChange('city', '');
  };

  const handleBioChange = (value) => {
    if (value.length <= 160) {
      handleFieldChange('bio', value);
      setBioCharCount(value.length);
    }
  };

  const handleUsernameChange = (value) => {
    // Remove @ se existir
    let cleanValue = value.replace(/^@/, '');

    // Se vazio, coloca só @
    if (!cleanValue) {
      handleFieldChange('username', '@');
      return;
    }

    // Remove caracteres inválidos (keep only alphanumeric and underscore)
    cleanValue = cleanValue.replace(/[^a-zA-Z0-9_]/g, '');

    // Limita a 30 caracteres (+ @ na frente)
    if (cleanValue.length > 30) {
      cleanValue = cleanValue.slice(0, 30);
    }

    // Adiciona @ na frente
    const newUsername = `@${cleanValue}`;
    handleFieldChange('username', newUsername);
  };

  const handlePhoneChange = (value) => {
    // Remove caracteres não numéricos
    let cleaned = value.replace(/\D/g, '');

    // Limita a 11 dígitos
    if (cleaned.length > 11) {
      cleaned = cleaned.slice(0, 11);
    }

    // Formata: (XX) XXXXX-XXXX
    let formatted = '';
    if (cleaned.length > 0) {
      if (cleaned.length <= 2) {
        formatted = `(${cleaned}`;
      } else if (cleaned.length <= 7) {
        formatted = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
      } else {
        formatted = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
      }
    }

    handleFieldChange('phone', formatted);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.displayName.trim()) {
      newErrors.displayName = 'Nome público é obrigatório';
    }
    if (formData.displayName.length > 50) {
      newErrors.displayName = 'Nome não pode exceder 50 caracteres';
    }

    if (!formData.username || formData.username === '@') {
      newErrors.username = 'Nome de usuário é obrigatório';
    }
    // Remove @ pra validar apenas os caracteres
    const usernameWithoutAt = formData.username.replace(/^@/, '');
    if (usernameWithoutAt.length < 3 || usernameWithoutAt.length > 30) {
      newErrors.username = 'Username deve ter 3–30 caracteres';
    }
    if (!/^[a-zA-Z0-9_]*$/.test(usernameWithoutAt)) {
      newErrors.username = 'Apenas letras, números e underscore';
    }

    if (formData.phone && !/^[\d\s\-\(\)]*$/.test(formData.phone)) {
      newErrors.phone = 'Formato de telefone inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileInput = (field, file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      console.error('Apenas imagens são permitidas');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      console.error('Arquivo não pode exceder 5MB');
      return;
    }

    setFiles(prev => ({ ...prev, [field]: file }));

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(prev => ({ ...prev, [field]: e.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarClick = () => {
    avatarInputRef.current?.click();
  };

  const handleBannerClick = () => {
    bannerInputRef.current?.click();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.style.borderColor = 'var(--engine-accent)';
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.style.borderColor = '';
  };

  const handleDrop = (e, field) => {
    e.preventDefault();
    e.currentTarget.style.borderColor = '';
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      handleFileInput(field, file);
    }
  };

  const uploadFile = async (file, path) => {
    try {
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (err) {
      console.error('Upload error:', err);
      throw new Error('Erro ao fazer upload da imagem');
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      console.error('Por favor, corrija os erros no formulário');
      return;
    }

    setLoading(true);
    try {
      let photoURL = preview.avatar || null;
      let bannerURL = preview.banner || null;

      if (files.avatar) {
        photoURL = await uploadFile(
          files.avatar,
          `users/${user.uid}/avatar-${Date.now()}`
        );
      }

      if (files.banner) {
        bannerURL = await uploadFile(
          files.banner,
          `users/${user.uid}/banner-${Date.now()}`
        );
      }

      await updateProfile(user, {
        displayName: formData.displayName,
        photoURL: photoURL,
      });

      const profileRef = doc(firestore, 'publicProfiles', user.uid);
      const updateData = {
        displayName: formData.displayName,
        username: formData.username.toLowerCase().replace(/^@/, ''),
        bio: formData.bio,
        phoneCountry: formData.phoneCountry,
        phone: formData.phone,
        country: formData.country,
        state: formData.state,
        city: formData.city,
        avatar: photoURL,
        bannerURL: bannerURL,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(profileRef, updateData);

      if (onSave) {
        onSave(updateData);
      }

      console.log('Perfil atualizado com sucesso!');
      onClose();
    } catch (err) {
      console.error('Save error:', err);
      console.error(err.message || 'Erro ao salvar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={(e) => {
      if (e.target === e.currentTarget) handleCancel();
    }}>
      <div className="w-full sm:max-w-2xl bg-[var(--engine-surface)] rounded-t-2xl sm:rounded-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-4 sm:p-6 border-b border-[var(--engine-border)] bg-[var(--engine-surface)]">
          <h1 className="text-lg font-semibold text-[var(--engine-text)]">Editar Perfil</h1>
          <button
            onClick={handleCancel}
            className="flex items-center justify-center w-8 h-8 rounded-full text-[var(--engine-text-muted)] hover:bg-[var(--engine-surface-2)] transition"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-8">
          {/* Media Section */}
          <div>
            {/* Banner */}
            <div
              onClick={handleBannerClick}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'banner')}
              className="relative w-full h-44 mb-4 bg-[var(--engine-surface-2)] border-2 border-dashed border-[var(--engine-border)] rounded-lg cursor-pointer transition hover:border-[var(--engine-accent)] overflow-hidden flex items-center justify-center"
              style={{
                backgroundImage: preview.banner ? `url('${preview.banner}')` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileInput('banner', e.target.files?.[0])}
              />
              {!preview.banner && (
                <div className="text-center pointer-events-none">
                  <p className="text-sm font-medium text-[var(--engine-text-muted)]">Clique ou arraste uma imagem</p>
                </div>
              )}
            </div>

            {/* Avatar */}
            <div className="flex justify-center pb-8">
              <div
                onClick={handleAvatarClick}
                className="relative w-24 h-24 rounded-full overflow-hidden bg-[var(--engine-surface-2)] border-4 border-[var(--engine-surface)] cursor-pointer transition hover:border-[var(--engine-accent)] flex items-center justify-center group"
              >
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileInput('avatar', e.target.files?.[0])}
                />
                {preview.avatar ? (
                  <img
                    src={preview.avatar}
                    alt="Avatar preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-3xl">A</div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-full transition text-white text-sm">
                  Editar
                </div>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--engine-text-muted)] mb-4">Informações Básicas</p>
            <div className="space-y-4">
              {/* Display Name */}
              <div>
                <label className="text-sm font-medium text-[var(--engine-text)]">
                  Nome Público <span className="text-[var(--engine-accent)]">*</span>
                </label>
                <input
                  type="text"
                  maxLength={50}
                  placeholder="Seu nome completo"
                  value={formData.displayName}
                  onChange={(e) => handleFieldChange('displayName', e.target.value)}
                  className={`w-full px-3 py-2.5 mt-2 bg-[var(--engine-elevated)] border rounded-lg text-sm transition focus:outline-none focus:border-[var(--engine-accent)] focus:ring-4 focus:ring-[var(--engine-accent)]/20 ${
                    errors.displayName ? 'border-red-500' : 'border-[var(--engine-border)]'
                  }`}
                />
                {errors.displayName && (
                  <p className="text-xs text-red-500 mt-1">{errors.displayName}</p>
                )}
              </div>

              {/* Username */}
              <div>
                <label className="text-sm font-medium text-[var(--engine-text)]">
                  Usuário <span className="text-[var(--engine-accent)]">*</span>
                </label>
                <input
                  type="text"
                  maxLength={31}
                  placeholder="@username"
                  value={formData.username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className={`w-full px-3 py-2.5 mt-2 bg-[var(--engine-elevated)] border rounded-lg text-sm font-mono transition focus:outline-none focus:border-[var(--engine-accent)] focus:ring-4 focus:ring-[var(--engine-accent)]/20 ${
                    errors.username ? 'border-red-500' : 'border-[var(--engine-border)]'
                  }`}
                />
                <p className="text-xs text-[var(--engine-text-subtle)] mt-1">@ é adicionado automaticamente • 3–30 caracteres</p>
                {errors.username && (
                  <p className="text-xs text-red-500 mt-1">{errors.username}</p>
                )}
              </div>

              {/* Bio */}
              <div>
                <label className="text-sm font-medium text-[var(--engine-text)]">Bio</label>
                <textarea
                  maxLength={160}
                  placeholder="Conte sobre você"
                  value={formData.bio}
                  onChange={(e) => handleBioChange(e.target.value)}
                  className="w-full px-3 py-2.5 mt-2 bg-[var(--engine-elevated)] border border-[var(--engine-border)] rounded-lg text-sm resize-none min-h-24 transition focus:outline-none focus:border-[var(--engine-accent)] focus:ring-4 focus:ring-[var(--engine-accent)]/20"
                />
                <p className="text-xs text-[var(--engine-text-subtle)] mt-1">{bioCharCount}/160</p>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--engine-text-muted)] mb-4">Contato</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[var(--engine-text)]">Código País</label>
                <select
                  value={formData.phoneCountry}
                  onChange={(e) => handleFieldChange('phoneCountry', e.target.value)}
                  className="w-full px-3 py-2.5 mt-2 bg-[var(--engine-elevated)] border border-[var(--engine-border)] rounded-lg text-sm text-[var(--engine-text)] transition focus:outline-none focus:border-[var(--engine-accent)]"
                >
                  <option value="+55">Brasil (+55)</option>
                  <option value="+1">EUA (+1)</option>
                  <option value="+34">Espanha (+34)</option>
                  <option value="+54">Argentina (+54)</option>
                  <option value="+56">Chile (+56)</option>
                  <option value="+57">Colômbia (+57)</option>
                  <option value="+51">Peru (+51)</option>
                  <option value="+55">Portugal (+351)</option>
                  <option value="+55">México (+52)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--engine-text)]">Telefone</label>
                <input
                  type="tel"
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                  value={formData.phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className={`w-full px-3 py-2.5 mt-2 bg-[var(--engine-elevated)] border rounded-lg text-sm font-mono transition focus:outline-none focus:border-[var(--engine-accent)] ${
                    errors.phone ? 'border-red-500' : 'border-[var(--engine-border)]'
                  }`}
                />
                {errors.phone && (
                  <p className="text-xs text-red-500 mt-1">{errors.phone}</p>
                )}
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--engine-text-muted)] mb-4">Localização</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[var(--engine-text)]">País</label>
                  <select
                    value={formData.country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full px-3 py-2.5 mt-2 bg-[var(--engine-elevated)] border border-[var(--engine-border)] rounded-lg text-sm transition focus:outline-none focus:border-[var(--engine-accent)]"
                  >
                    {countries.map(c => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--engine-text)]">Estado</label>
                  <select
                    value={formData.state}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="w-full px-3 py-2.5 mt-2 bg-[var(--engine-elevated)] border border-[var(--engine-border)] rounded-lg text-sm transition focus:outline-none focus:border-[var(--engine-accent)]"
                  >
                    <option value="">Selecione</option>
                    {stateOptions.map(s => (
                      <option key={s.code} value={s.code}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--engine-text)]">Cidade</label>
                <input
                  type="text"
                  placeholder="São Paulo"
                  maxLength={80}
                  value={formData.city}
                  onChange={(e) => handleFieldChange('city', e.target.value)}
                  className="w-full px-3 py-2.5 mt-2 bg-[var(--engine-elevated)] border border-[var(--engine-border)] rounded-lg text-sm transition focus:outline-none focus:border-[var(--engine-accent)]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex gap-3 p-4 sm:p-6 border-t border-[var(--engine-border)] bg-[var(--engine-surface)]">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-[var(--engine-accent)] text-white font-semibold rounded-lg transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-transparent text-[var(--engine-text)] border border-[var(--engine-border)] font-semibold rounded-lg transition hover:bg-[var(--engine-surface-2)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
