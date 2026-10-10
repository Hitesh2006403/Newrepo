// Unified API client: seamlessly toggles between local mock storage and live backend REST APIs
import {
  INITIAL_USERS,
  INITIAL_DONATIONS,
  INITIAL_RECIPIENT_REQUIREMENTS,
  INITIAL_DELIVERY_TASKS,
  INITIAL_IMPACT_METRICS,
  INITIAL_REVIEWS,
  INITIAL_VERIFIED_HANDOVERS,
  INITIAL_PARTNERS_DIRECTORY,
} from './mockData';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Local storage keys for persisting mock state across browser refreshes
const STORAGE_KEYS = {
  USERS: 'sap_users_v1',
  DONATIONS: 'sap_donations_v1',
  REQUIREMENTS: 'sap_requirements_v1',
  TASKS: 'sap_tasks_v1',
  METRICS: 'sap_metrics_v1',
  CURRENT_USER: 'sap_current_user_v1',
  REVIEWS: 'sap_reviews_v1',
};

// State initializer
const loadOrInit = (key, initial) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (key === STORAGE_KEYS.DONATIONS && Array.isArray(parsed)) {
      const existingIds = new Set(parsed.map((d) => d.id));
      const enriched = parsed.map((d) => {
        if (!d.venueType) {
          const match = initial.find((init) => init.id === d.id);
          if (match?.venueType) return { ...d, venueType: match.venueType };
          const text = `${d.donorName || ''} ${d.foodName || ''}`.toLowerCase();
          if (/hotel|hyatt|sheraton/i.test(text)) return { ...d, venueType: 'HOTELS' };
          if (/restaurant|resturant|bistro|bakery/i.test(text)) return { ...d, venueType: 'Resturant' };
          if (/catering|event|venue|pavilion/i.test(text)) return { ...d, venueType: 'Event venue' };
          return { ...d, venueType: 'Others' };
        }
        return d;
      });
      for (const item of initial) {
        if (!existingIds.has(item.id)) enriched.push(item);
      }
      localStorage.setItem(key, JSON.stringify(enriched));
      return enriched;
    }
    return parsed;
  } catch {
    return initial;
  }
};

const save = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
};

// Initialize in-memory / persisted mock store
let mockUsers = loadOrInit(STORAGE_KEYS.USERS, INITIAL_USERS);
let mockDonations = loadOrInit(STORAGE_KEYS.DONATIONS, INITIAL_DONATIONS);
let mockRequirements = loadOrInit(STORAGE_KEYS.REQUIREMENTS, INITIAL_RECIPIENT_REQUIREMENTS);
let mockTasks = loadOrInit(STORAGE_KEYS.TASKS, INITIAL_DELIVERY_TASKS);
let mockMetrics = loadOrInit(STORAGE_KEYS.METRICS, INITIAL_IMPACT_METRICS);
let mockReviews = loadOrInit(STORAGE_KEYS.REVIEWS, INITIAL_REVIEWS);

// Simulated network delay helper
const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

export const api = {
  // ----------------------------------------------------
  // AUTHENTICATION
  // ----------------------------------------------------
  login: async (email, password) => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid credentials');
      if (data.user) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(data.user));
      }
      return data;
    }

    await delay(150);
    const user = mockUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      throw new Error('User not found. Use one-click member login or register.');
    }
    if (password && user.password && password !== user.password && password !== 'password123') {
      throw new Error('Incorrect password. Please use the member credentials provided on the card.');
    }
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    return { token: 'mock-jwt-token-' + user.id, user };
  },

  // Genuine Google OAuth 2.0 Credential Verification on Backend
  loginWithGoogle: async (credential, role = 'donor', portalVerificationData = {}) => {
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential, role, portalVerificationData }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Google authentication rejected by server.');
      }
      if (data.user) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(data.user));
      }
      return data;
    } catch (err) {
      throw err;
    }
  },

  getMe: async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.user) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(data.user));
        return data.user;
      }
      return null;
    } catch {
      return null;
    }
  },

  logoutSession: async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore
    }
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  },

  register: async (userData) => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(userData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');
      if (data.user) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(data.user));
      }
      return data;
    }

    await delay();
    const newUser = {
      id: 'user-' + Date.now(),
      ...userData,
      rating: 5.0,
      totalDonations: 0,
      verified: true,
    };
    mockUsers.push(newUser);
    save(STORAGE_KEYS.USERS, mockUsers);
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));
    return { token: 'mock-jwt-token-' + newUser.id, user: newUser };
  },

  getCurrentUser: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    // Default to Donor for instant preview
    const defaultUser = mockUsers[0];
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(defaultUser));
    return defaultUser;
  },

  switchUser: (userId) => {
    const user = mockUsers.find((u) => u.id === userId);
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    }
    return user;
  },

  getAllUsers: () => mockUsers,

  // ----------------------------------------------------
  // DONATIONS (Donor Journey)
  // ----------------------------------------------------
  getDonations: async (filter = {}) => {
    if (!USE_MOCK) {
      const query = new URLSearchParams(filter).toString();
      const res = await fetch(`${API_BASE}/donations?${query}`);
      return await res.json();
    }
    await delay(150);
    let list = [...mockDonations];
    if (filter.donorId) {
      list = list.filter((d) => d.donorId === filter.donorId);
    }
    if (filter.status && filter.status !== 'ALL') {
      list = list.filter((d) => d.status === filter.status);
    }
    return list;
  },

  createDonation: async (donationData) => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/donations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donationData),
      });
      return await res.json();
    }
    await delay(300);
    const newDonation = {
      id: 'don-' + Math.floor(100 + Math.random() * 900),
      createdAt: new Date().toISOString(),
      status: 'AVAILABLE',
      remainingQuantity: Number(donationData.initialQuantity),
      handoverQrToken: 'SAP-QR-' + Date.now().toString(36).toUpperCase(),
      matchedRecipients: [],
      ...donationData,
    };
    mockDonations.unshift(newDonation);
    save(STORAGE_KEYS.DONATIONS, mockDonations);

    // Update impact counters
    mockMetrics.activeDonationsCount += 1;
    save(STORAGE_KEYS.METRICS, mockMetrics);

    return newDonation;
  },

  reopenDonation: async (donationId, notes = '') => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/donations/${donationId}/reopen`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      return await res.json();
    }
    await delay(200);
    const don = mockDonations.find((d) => d.id === donationId);
    if (!don) throw new Error('Donation not found');

    don.status = 'REOPENED';
    don.canReopen = false;
    don.reopenedAt = new Date().toISOString();
    don.reopenNotes = notes || 'Reopened and offered to nearby community shelters';
    save(STORAGE_KEYS.DONATIONS, mockDonations);
    return don;
  },

  // ----------------------------------------------------
  // RECIPIENT JOURNEY & PARTIAL ACCEPTANCE
  // ----------------------------------------------------
  getRequirements: async () => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/recipient/requirements`);
      return await res.json();
    }
    await delay(100);
    return mockRequirements;
  },

  postRequirement: async (reqData) => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/recipient/requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqData),
      });
      return await res.json();
    }
    await delay(250);
    const newReq = {
      id: 'req-' + Math.floor(200 + Math.random() * 800),
      createdAt: new Date().toISOString(),
      status: 'ACTIVE',
      ...reqData,
    };
    mockRequirements.unshift(newReq);
    save(STORAGE_KEYS.REQUIREMENTS, mockRequirements);
    return newReq;
  },

  getSmartMatches: async (recipientId) => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/recipient/matches?recipientId=${recipientId}`);
      return await res.json();
    }
    await delay(200);
    // Find active donations that have remaining food
    const eligible = mockDonations.filter(
      (d) => (d.status === 'AVAILABLE' || d.status === 'PARTIALLY_ACCEPTED' || d.status === 'REOPENED') && d.remainingQuantity > 0
    );

    // Calculate smart match scores with reasoning tags
    return eligible.map((don, idx) => {
      const expiryMs = new Date(don.expiryDeadline).getTime() - Date.now();
      const hoursLeft = Math.max(0.5, expiryMs / (1000 * 60 * 60));
      
      let baseScore = 95 - idx * 3;
      if (hoursLeft < 2) baseScore += 4; // Urgency boost
      const score = Math.min(99, Math.max(78, Math.round(baseScore)));

      const reasons = [
        `Within ${ (1.1 + idx * 0.7).toFixed(1) } km radius`,
        hoursLeft < 2 ? 'High Urgency: Ready for immediate collection' : 'Verified hygiene packaging',
        `${don.remainingQuantity} ${don.unit} surplus available`,
      ];

      return {
        donation: don,
        matchScore: score,
        distanceKm: (1.1 + idx * 0.7).toFixed(1),
        reasons,
      };
    });
  },

  acceptDonation: async ({ donationId, recipientId, recipientName, quantityAccepted, notes }) => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/donations/${donationId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId, quantityAccepted, notes }),
      });
      return await res.json();
    }
    await delay(300);
    const don = mockDonations.find((d) => d.id === donationId);
    if (!don) throw new Error('Donation not found');

    const qty = Number(quantityAccepted);
    if (qty <= 0 || qty > don.remainingQuantity) {
      throw new Error(`Invalid quantity. Must be between 1 and ${don.remainingQuantity}`);
    }

    don.remainingQuantity -= qty;
    if (don.remainingQuantity === 0) {
      don.status = 'ACCEPTED';
    } else {
      don.status = 'PARTIALLY_ACCEPTED';
    }

    if (!don.matchedRecipients) don.matchedRecipients = [];
    don.matchedRecipients.push({
      recipientId,
      recipientName,
      claimedQuantity: qty,
      claimedAt: new Date().toISOString(),
      notes,
    });

    // Create a new delivery task automatically
    const newTask = {
      id: 'task-' + Math.floor(400 + Math.random() * 600),
      donationId: don.id,
      deliveryAgentId: 'user-delivery-1',
      foodName: don.foodName,
      quantity: `${qty} ${don.unit}`,
      foodType: don.foodType,
      storageCondition: don.storageCondition,
      urgencyLevel: 'HIGH',
      pickup: {
        location: don.pickupLocation?.address || 'Donor Location',
        donorName: don.donorName,
        donorPhone: don.donorPhone || '+91 98765 43210',
        deadline: don.expiryDeadline,
      },
      dropoff: {
        location: 'Recipient Shelter Location',
        recipientName: recipientName,
        recipientPhone: '+91 91234 56789',
        deadline: don.expiryDeadline,
      },
      currentMilestone: 'ASSIGNED',
      distanceTotalKm: 3.4,
      estimatedMinutes: 20,
      qrRequiredToken: don.handoverQrToken,
      safetyChecklistCompleted: false,
      verifiedAt: null,
    };

    mockTasks.unshift(newTask);
    save(STORAGE_KEYS.TASKS, mockTasks);
    save(STORAGE_KEYS.DONATIONS, mockDonations);

    return { donation: don, task: newTask };
  },

  // ----------------------------------------------------
  // DELIVERY AGENT JOURNEY & QR VERIFICATION
  // ----------------------------------------------------
  getDeliveryTasks: async (deliveryAgentId) => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/delivery/tasks?agentId=${deliveryAgentId}`);
      return await res.json();
    }
    await delay(150);
    return mockTasks;
  },

  updateDeliveryMilestone: async (taskId, nextMilestone) => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/delivery/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextMilestone }),
      });
      return await res.json();
    }
    await delay(200);
    const task = mockTasks.find((t) => t.id === taskId);
    if (!task) throw new Error('Task not found');

    task.currentMilestone = nextMilestone;
    save(STORAGE_KEYS.TASKS, mockTasks);
    return task;
  },

  verifyHandoverQr: async ({ taskId, qrToken, safetyChecklist }) => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/handover/verify-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, qrToken, safetyChecklist }),
      });
      return await res.json();
    }
    await delay(400);
    const task = mockTasks.find((t) => t.id === taskId);
    if (!task) throw new Error('Task not found');

    // Strict validation: QR token must match
    if (qrToken !== task.qrRequiredToken) {
      throw new Error('Invalid QR Code. Verification failed.');
    }

    // Safety checks validation
    if (!safetyChecklist.sealIntact || !safetyChecklist.temperatureChecked || !safetyChecklist.noSpillage) {
      throw new Error('Safety checklist must be fully verified before handover completion.');
    }

    task.currentMilestone = 'DELIVERED';
    task.safetyChecklistCompleted = true;
    task.verifiedAt = new Date().toISOString();

    // Mark donation as completed
    const don = mockDonations.find((d) => d.id === task.donationId);
    if (don) {
      don.status = 'COMPLETED';
      don.completedAt = new Date().toISOString();
    }

    // Update metrics
    mockMetrics.completedDeliveriesCount += 1;
    mockMetrics.totalMealsRescued += parseInt(task.quantity) || 35;
    mockMetrics.totalCo2PreventedKg += Math.round((parseInt(task.quantity) || 35) * 1.8);

    save(STORAGE_KEYS.TASKS, mockTasks);
    save(STORAGE_KEYS.DONATIONS, mockDonations);
    save(STORAGE_KEYS.METRICS, mockMetrics);

    return { success: true, task, donation: don };
  },

  // ----------------------------------------------------
  // ADMIN DASHBOARD & METRICS
  // ----------------------------------------------------
  getImpactMetrics: async () => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/admin/metrics`);
      return await res.json();
    }
    await delay(100);
    return mockMetrics;
  },

  // ----------------------------------------------------
  // REVIEWS & COMMUNITY FEEDBACK
  // ----------------------------------------------------
  getReviews: async () => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/reviews`);
      return await res.json();
    }
    await delay(100);
    return mockReviews;
  },

  submitReview: async (reviewData) => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewData),
      });
      return await res.json();
    }
    await delay(250);
    const newReview = {
      id: 'rev-' + Date.now(),
      createdAt: new Date().toISOString(),
      verifiedRescue: true,
      ...reviewData,
    };
    mockReviews.unshift(newReview);
    save(STORAGE_KEYS.REVIEWS, mockReviews);
    return newReview;
  },

  // ----------------------------------------------------
  // VERIFIED USAGE & PARTNER DIRECTORY TELEMETRY
  // ----------------------------------------------------
  getVerifiedHandovers: async () => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/admin/verified-handovers`);
      return await res.json();
    }
    await delay(100);
    return INITIAL_VERIFIED_HANDOVERS;
  },

  getPartnersDirectory: async () => {
    if (!USE_MOCK) {
      const res = await fetch(`${API_BASE}/admin/partners`);
      return await res.json();
    }
    await delay(100);
    return INITIAL_PARTNERS_DIRECTORY;
  },

  resetDemoData: () => {
    mockUsers = INITIAL_USERS;
    mockDonations = INITIAL_DONATIONS;
    mockRequirements = INITIAL_RECIPIENT_REQUIREMENTS;
    mockTasks = INITIAL_DELIVERY_TASKS;
    mockMetrics = INITIAL_IMPACT_METRICS;
    mockReviews = INITIAL_REVIEWS;
    save(STORAGE_KEYS.USERS, INITIAL_USERS);
    save(STORAGE_KEYS.DONATIONS, INITIAL_DONATIONS);
    save(STORAGE_KEYS.REQUIREMENTS, INITIAL_RECIPIENT_REQUIREMENTS);
    save(STORAGE_KEYS.TASKS, INITIAL_DELIVERY_TASKS);
    save(STORAGE_KEYS.METRICS, INITIAL_IMPACT_METRICS);
    save(STORAGE_KEYS.REVIEWS, INITIAL_REVIEWS);
    return true;
  },
};

