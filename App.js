import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput,
  TouchableOpacity, ScrollView, ActivityIndicator,
  Linking, Platform, StatusBar as RNStatusBar, Alert, Modal, Dimensions
} from 'react-native';
import LineChart from 'react-native-chart-kit/dist/line-chart/LineChart';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrendingUp, BarChart2, Shield, Search, ExternalLink, ChevronRight, ArrowUpRight, Trash2, Edit2, LogOut, User, Settings, X, Star, Layout, Briefcase, Globe, Database } from 'lucide-react-native';

// Dynamic API URL from Expo environment variables
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://mrtonystark003-stockanalyst.hf.space';

export default function App() {
  const [userPhone, setUserPhone] = useState(null);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isAppReady, setIsAppReady] = useState(false);

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userPhone');
    } catch (e) {}
    setUserPhone(null);
    setPortfolioData([]);
    setShowPortfolio(false);
  };
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [editingHolding, setEditingHolding] = useState(null);
  const [isAddingToPortfolio, setIsAddingToPortfolio] = useState(false);
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [showAngelLogin, setShowAngelLogin] = useState(false);
  const [angelCreds, setAngelCreds] = useState({
    client_id: '',
    password: '',
    totp_secret: '',
    totp_code: '',
    save_credentials: true
  });
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [portfolioData, setPortfolioData] = useState([]);
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('indices'); // 'indices', 'portfolio', 'watchlist', 'research'
  const [livePrices, setLivePrices] = useState({});
  const [marketData, setMarketData] = useState({ indian: [], global: [], commodities: [], forex: [], crypto: [] });
  const [marketSentiment, setMarketSentiment] = useState(null);
  const [isMarketLoading, setIsMarketLoading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historySymbol, setHistorySymbol] = useState("");
  const [watchlist, setWatchlist] = useState([]);

  useEffect(() => {
    console.log('App mounting, starting checkUser...');
    checkUser();
  }, []);

  useEffect(() => {
    if (userPhone && activeTab === 'portfolio') {
      fetchPortfolio();
      // Start real-time price updates every 30 seconds for portfolio
      const priceInterval = setInterval(fetchPrices, 30000);
      fetchPrices(); // Initial fetch
      return () => clearInterval(priceInterval);
    }
    if (activeTab === 'indices') {
      fetchMarketData();
      fetchMarketSentiment();
      const interval = setInterval(() => {
        fetchMarketData();
        fetchMarketSentiment();
      }, 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [userPhone, activeTab]);

  const fetchPrices = async () => {
    if (!userPhone || portfolioData.length === 0) return; // Only fetch prices if user is logged in and has portfolio data
    try {
      const symbols = portfolioData.map(h => h.symbol);
      const resp = await fetch(`${API_URL}/portfolio/prices?user_id=${userPhone}&symbols=${symbols.join(',')}`);
      const data = await resp.json();
      setLivePrices(data);
    } catch (error) {
      console.error('Fetch prices error:', error);
    }
  };

  const checkUser = async () => {
    try {
      console.log('Checking AsyncStorage for userPhone...');
      const savedPhone = await AsyncStorage.getItem('userPhone');
      console.log('Found savedPhone:', savedPhone);
      if (savedPhone) {
        setUserPhone(savedPhone);
      }
    } catch (e) {
      console.warn('AsyncStorage error:', e.message);
    } finally {
      setIsAppReady(true);
    }
  };

  const handleAuth = async () => {
    const formattedPhone = phone.trim();
    const formattedPass = password.trim();

    if (!formattedPhone || !formattedPass) {
      Alert.alert("Error", "Please enter both phone and password");
      return;
    }

    setIsAnalyzing(true);
    try {
      const endpoint = isLoginMode ? '/auth/login' : '/auth/signup';
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: formattedPhone,
          password: formattedPass
        })
      });

      const data = await response.json();

      if (data.status === 'success') {
        const userToSave = formattedPhone;
        try {
          await AsyncStorage.setItem('userPhone', userToSave);
        } catch (e) {
          console.warn("AsyncStorage save failed", e);
        }
        setUserPhone(userToSave);
        Alert.alert("Success", isLoginMode ? "Logged in successfully" : "Account created!");
      } else {
        // Special case: if trying to signup but user exists without password
        if (!isLoginMode && data.message.includes("already exists")) {
            Alert.alert("User Exists", "This number is already registered. Please Login instead.");
            setIsLoginMode(true);
        } else {
            Alert.alert("Auth Error", data.message || "Something went wrong");
        }
      }
    } catch (e) {
      console.error('Auth error', e);
      Alert.alert("Network Error", `Could not connect to ${API_URL}`);
    } finally {
      setIsAnalyzing(false);
    }
  };


  const syncHoldings = async (broker, isManual = false) => {
    // If it's the specific broker login modal, we skip the silent check
    if (broker === 'angelone' && !showAngelLogin && !isManual) {
      // Try silent sync first
      setIsAnalyzing(true);
      try {
        const resp = await fetch(`${API_URL}/broker/sync/${broker}?user_id=${userPhone}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userPhone })
        });
        const data = await resp.json();
        if (data.status === 'success') {
          Alert.alert("Success", data.message);
          fetchPortfolio();
          fetchPrices();
          setIsAnalyzing(false);
          return;
        }
      } catch (e) {
        console.log("Silent sync failed, showing modal");
      }
      setIsAnalyzing(false);
      setShowAngelLogin(true);
      setShowBrokerModal(false);
      return;
    }

    setIsAnalyzing(true);
    try {
      const resp = await fetch(`${API_URL}/broker/sync/${broker}?user_id=${userPhone}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userPhone,
          ...angelCreds,
          save_credentials: true // Default to true for internal automation
        })
      });
      const data = await resp.json();
      if (data.status === 'success') {
        Alert.alert("Success", data.message);
        fetchPortfolio();
        fetchPrices();
        setShowAngelLogin(false);
      } else {
        Alert.alert("Sync Failed", data.message || "Could not sync holdings.");
      }
    } catch (error) {
      console.error('Broker sync error:', error);
      Alert.alert("Error", "Failed to connect to broker sync service.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getCurrency = (symbol) => {
    if (!symbol) return '$';
    return (symbol.endsWith('.NS') || symbol.endsWith('.BO')) ? '₹' : '$';
  };

  // Search for tickers
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length > 1) {
        setIsSearching(true);
        try {
          const response = await fetch(`${API_URL}/search?q=${query}`);
          const data = await response.json();
          setSearchResults(data.results || []);
        } catch (error) {
          console.error('Search error:', error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleAnalyze = async (symbol) => {
    setSearchResults([]);
    setQuery('');
    setIsAnalyzing(true);
    setAnalysis(null);
    try {
      const response = await fetch(`${API_URL}/analyze?symbol=${symbol}`);
      const data = await response.json();
      setAnalysis(data);
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };


  const fetchPortfolio = async () => {
    if (!userPhone) return;
    try {
      const response = await fetch(`${API_URL}/portfolio?user_id=${userPhone}`);
      const data = await response.json();
      if (data.status === 'success') {
        const holdings = data.portfolio.holdings || [];
        setPortfolioData(holdings);
        setShowPortfolio(true);
        setAnalysis(null);
      }
    } catch (error) {
      console.error('Fetch portfolio error:', error);
    }
  };

  const fetchMarketData = async () => {
    setIsMarketLoading(true);
    try {
      const response = await fetch(`${API_URL}/market/indices`);
      const data = await response.json();
      setMarketData(data);
    } catch (error) {
      console.error('Error fetching market data:', error);
    } finally {
      setIsMarketLoading(false);
    }
  };

  const getSymbolData = (symbol) => {
    if (!marketData) return null;
    for (const cat in marketData) {
      if (Array.isArray(marketData[cat])) {
        const found = marketData[cat].find(i => i.symbol === symbol);
        if (found) return found;
      }
    }
    return null;
  };

  const fetchHistory = async (symbol) => {
    setIsHistoryLoading(true);
    setHistorySymbol(symbol);
    setShowHistoryModal(true);
    try {
      const response = await fetch(`${API_URL}/market/history/${symbol}?period=30d`);
      const data = await response.json();
      if (data.history) {
        setSelectedHistory(data.history);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const fetchMarketSentiment = async () => {
    try {
      const response = await fetch(`${API_URL}/market/sentiment`);
      const data = await response.json();
      if (data.status === 'success') {
        setMarketSentiment(data.sentiment);
      }
    } catch (error) {
      console.error('Error fetching market sentiment:', error);
    }
  };

  const updateHolding = async () => {
    try {
      await fetch(`${API_URL}/portfolio/update?user_id=${userPhone}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: editingHolding.symbol,
          quantity: parseFloat(editQty),
          average_price: parseFloat(editPrice)
        })
      });
      fetchPortfolio();
      setEditingHolding(null);
    } catch (error) {
      console.error('Update error:', error);
    }
  };

  const deleteHolding = async (symbol) => {
    try {
      await fetch(`${API_URL}/portfolio/${symbol}?user_id=${userPhone}`, { method: 'DELETE' });
      setPortfolioData(prev => prev.filter(item => item.symbol !== symbol));
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handleStartAdd = () => {
    if (!analysis) return;
    setEditQty('1');
    setEditPrice(analysis.results.quantitative.technicals.current_price?.toString() || '0');
    setIsAddingToPortfolio(true);
  };

  const confirmAddToPortfolio = async () => {
    try {
      const resp = await fetch(`${API_URL}/portfolio/add?user_id=${userPhone}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: analysis.symbol,
          quantity: parseFloat(editQty),
          average_price: parseFloat(editPrice)
        })
      });
      const data = await resp.json();
      if (data.status === 'success') {
        Alert.alert("Success", `Added ${analysis.symbol} to portfolio!`);
        setIsAddingToPortfolio(false);
        fetchPortfolio();
      } else {
        Alert.alert("Error", data.message);
      }
    } catch (error) {
      console.error('Add to portfolio error:', error);
      Alert.alert("Error", "Failed to add to portfolio");
    }
  };

  if (!isAppReady) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  if (!userPhone) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <View style={{ flex: 1, justifyContent: 'center', padding: 30 }}>
            <View style={styles.logo}>
              <TrendingUp size={32} color="#fff" />
            </View>
            <Text style={[styles.resultSymbol, { fontSize: 32, marginTop: 20 }]}>
               {isLoginMode ? 'Login' : 'Create Account'}
            </Text>
            <Text style={[styles.gridLabel, { marginTop: 10, marginBottom: 30 }]}>
              {isLoginMode ? 'Welcome back! Enter your details.' : 'Join StockAnalyst.ai to track your portfolio.'}
            </Text>
            
            <TextInput 
              style={styles.modalInput}
              placeholder="Mobile Number"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <TextInput 
              style={[styles.modalInput, { marginTop: 10 }]}
              placeholder="Password"
              placeholderTextColor="rgba(255,255,255,0.3)"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity 
              style={[styles.button, { marginTop: 20 }]}
              onPress={handleAuth}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{isLoginMode ? 'Sign In' : 'Sign Up'}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setIsLoginMode(!isLoginMode)}
              style={{ marginTop: 20, alignItems: 'center' }}
            >
              <Text style={[styles.gridLabel, { color: '#0ea5e9' }]}>
                {isLoginMode ? "Don't have an account? Sign Up" : "Already have an account? Login"}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <TouchableOpacity onPress={() => { setAnalysis(null); setActiveTab('indices'); }} style={styles.logo}>
            <TrendingUp size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.logoText}>StockAnalyst<Text style={styles.accent}>.ai</Text></Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}>
          {/* Portfolio button removed from here, now in tabs */}
          <TouchableOpacity onPress={() => setShowProfileModal(true)}>
            <User size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Indices View - Now focused on market overview only */}
        {activeTab === 'indices' && (
          <View style={styles.resultsContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={styles.resultSymbol}>Market Overview</Text>
              {isMarketLoading && <ActivityIndicator size="small" color="#0ea5e9" />}
            </View>
            
            <Text style={[styles.sectionTitle, { fontSize: 14, marginTop: 5 }]}>Indian Indices</Text>
            <View style={[styles.gridRow, { flexWrap: 'wrap' }]}>
              {marketData.indian.map((item) => (
                <TouchableOpacity 
                  key={item.symbol} 
                  style={[styles.gridItem, { minWidth: '45%', backgroundColor: item.percent_change >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}
                  onPress={() => fetchHistory(item.symbol)}
                >
                  <Text style={styles.gridLabel}>{item.name}</Text>
                  <Text style={[styles.gridValue, { color: item.percent_change >= 0 ? '#4ade80' : '#f87171' }]}>{item.price.toLocaleString()}</Text>
                  <Text style={{ color: item.percent_change >= 0 ? '#4ade80' : '#f87171', fontSize: 10 }}>
                    {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)} ({item.percent_change.toFixed(2)}%)
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { fontSize: 14, marginTop: 25 }]}>Global Indices</Text>
            <View style={[styles.gridRow, { flexWrap: 'wrap' }]}>
              {marketData.global.map((item) => (
                <TouchableOpacity 
                  key={item.symbol} 
                  style={[styles.gridItem, { minWidth: '45%' }]}
                  onPress={() => fetchHistory(item.symbol)}
                >
                  <Text style={styles.gridLabel}>{item.name}</Text>
                  <Text style={[styles.gridValue, { color: item.percent_change >= 0 ? '#4ade80' : '#f87171' }]}>{item.price.toLocaleString()}</Text>
                  <Text style={{ color: item.percent_change >= 0 ? '#4ade80' : '#f87171', fontSize: 10 }}>
                    {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)} ({item.percent_change.toFixed(2)}%)
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { fontSize: 14, marginTop: 25 }]}>Commodities</Text>
            <View style={[styles.gridRow, { flexWrap: 'wrap' }]}>
              {marketData.commodities.map((item) => (
                <TouchableOpacity 
                  key={item.symbol} 
                  style={[styles.gridItem, { minWidth: '45%' }]}
                  onPress={() => fetchHistory(item.symbol)}
                >
                  <Text style={styles.gridLabel}>{item.name}</Text>
                  <Text style={[styles.gridValue, { color: '#fbbf24' }]}>
                    {item.currency}{item.price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </Text>
                  <Text style={{ color: item.percent_change >= 0 ? '#4ade80' : '#f87171', fontSize: 10 }}>
                    {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)} ({item.percent_change.toFixed(2)}%)
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { fontSize: 14, marginTop: 25 }]}>Forex Rates (to ₹)</Text>
            <View style={[styles.gridRow, { flexWrap: 'wrap' }]}>
              {marketData.forex.map((item) => (
                <TouchableOpacity 
                  key={item.symbol} 
                  style={[styles.gridItem, { minWidth: '45%' }]}
                  onPress={() => fetchHistory(item.symbol)}
                >
                  <Text style={styles.gridLabel}>{item.name}</Text>
                  <Text style={[styles.gridValue, { color: '#818cf8' }]}>₹{item.price.toFixed(2)}</Text>
                  <Text style={{ color: item.percent_change >= 0 ? '#4ade80' : '#f87171', fontSize: 10 }}>
                    {item.change >= 0 ? '+' : ''}{item.change.toFixed(4)} ({item.percent_change.toFixed(2)}%)
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { fontSize: 14, marginTop: 25 }]}>Cryptocurrencies</Text>
            <View style={[styles.gridRow, { flexWrap: 'wrap' }]}>
              {marketData.crypto.map((item) => (
                <TouchableOpacity 
                  key={item.symbol} 
                  style={[styles.gridItem, { minWidth: '45%' }]}
                  onPress={() => fetchHistory(item.symbol)}
                >
                  <Text style={styles.gridLabel}>{item.name}</Text>
                  <Text style={[styles.gridValue, { color: '#f59e0b' }]}>${item.price.toLocaleString()}</Text>
                  <Text style={{ color: item.percent_change >= 0 ? '#4ade80' : '#f87171', fontSize: 10 }}>
                    {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)} ({item.percent_change.toFixed(2)}%)
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* AI Market Sentiment Card */}
            <View style={[styles.card, { marginTop: 25, borderLeftColor: '#0ea5e9', borderLeftWidth: 4 }]}>
                <View style={[styles.cardHeader, { marginBottom: 10 }]}>
                    <TrendingUp size={18} color="#0ea5e9" />
                    <Text style={styles.cardTitle}>AI Market Pulse</Text>
                </View>
                {marketSentiment ? (
                    <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                            <View style={[styles.badge, { 
                                backgroundColor: marketSentiment.label === 'Bullish' ? 'rgba(74, 222, 128, 0.1)' : 
                                               marketSentiment.label === 'Bearish' ? 'rgba(248, 113, 113, 0.1)' : 
                                               'rgba(245, 158, 11, 0.1)',
                                borderColor: marketSentiment.label === 'Bullish' ? '#4ade80' : 
                                           marketSentiment.label === 'Bearish' ? '#f87171' : 
                                           '#f59e0b',
                                borderWidth: 1,
                                paddingHorizontal: 12,
                                paddingVertical: 4
                            }]}>
                                <Text style={[styles.badgeText, { 
                                    color: marketSentiment.label === 'Bullish' ? '#4ade80' : 
                                           marketSentiment.label === 'Bearish' ? '#f87171' : 
                                           '#f59e0b',
                                    fontSize: 12
                                }]}>
                                    {marketSentiment.label.toUpperCase()}
                                </Text>
                            </View>
                            <Text style={[styles.gridLabel, { marginLeft: 10, marginBottom: 0 }]}>
                                {marketSentiment.signals ? marketSentiment.signals.join(' • ') : ''}
                            </Text>
                        </View>
                        
                        <Text style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 20, marginBottom: 15 }}>
                            {marketSentiment.insight}
                        </Text>
                        
                        <View style={{ backgroundColor: 'rgba(14, 165, 233, 0.1)', padding: 12, borderRadius: 12, borderLeftColor: '#0ea5e9', borderLeftWidth: 3 }}>
                            <Text style={[styles.gridLabel, { color: '#0ea5e9', marginBottom: 4 }]}>ACTION POINT</Text>
                            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{marketSentiment.action}</Text>
                        </View>

                        {marketSentiment.note && (
                            <Text style={[styles.gridLabel, { marginTop: 10, fontSize: 9, opacity: 0.5 }]}>
                                * {marketSentiment.note}
                            </Text>
                        )}
                    </View>
                ) : (
                    <ActivityIndicator color="#0ea5e9" size="small" style={{ alignSelf: 'flex-start', marginTop: 5 }} />
                )}
            </View>
          </View>
        )}

        {/* Portfolio View */}
        {activeTab === 'portfolio' && (
          <View style={styles.resultsContainer}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultSymbol}>Portfolio</Text>
              <TouchableOpacity onPress={() => setActiveTab('indices')} style={styles.convictionBox}>
                <Text style={styles.convictionValue}>Home</Text>
              </TouchableOpacity>
            </View>

            {portfolioData.length === 0 ? (
              <View style={styles.card}>
                <Text style={[styles.subtitle, { padding: 20 }]}>No holdings yet.</Text>
              </View>
            ) : (
              <>
                {/* Total Portfolio Value Card */}
                {(() => {
                  let totalInvested = 0;
                  let totalCurrent = 0;
                  portfolioData.forEach(h => {
                    const current = livePrices[h.symbol] || h.average_price;
                    totalInvested += h.quantity * h.average_price;
                    totalCurrent += h.quantity * current;
                  });
                  const totalProfit = totalCurrent - totalInvested;
                  const totalProfitPct = (totalProfit / totalInvested) * 100;
                  
                  return (
                    <View style={[styles.card, { backgroundColor: '#1e293b' }]}>
                      <Text style={styles.statLabel}>Total Portfolio Value</Text>
                      <Text style={[styles.resultSymbol, { fontSize: 28, marginVertical: 5 }]}>
                        {totalCurrent.toFixed(2)}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 15 }}>
                        <View>
                          <Text style={styles.statLabel}>Day's P&L</Text>
                          <Text style={{ color: totalProfit >= 0 ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>
                            {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)} ({totalProfitPct.toFixed(2)}%)
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.statLabel}>Invested</Text>
                          <Text style={{ color: '#fff' }}>{totalInvested.toFixed(2)}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })()}

                {portfolioData.map((item, idx) => {
                  const currPrice = livePrices[item.symbol] || item.average_price;
                  const profit = (currPrice - item.average_price) * item.quantity;
                  const profitPct = ((currPrice - item.average_price) / item.average_price) * 100;
                  
                  return (
                    <View key={idx} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{item.symbol}</Text>
                          <Text style={[styles.gridLabel, { marginTop: 2 }]}>{item.quantity} Shares</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.gridValue, { fontSize: 18 }]}>
                            {getCurrency(item.symbol)}{currPrice.toFixed(2)}
                          </Text>
                          <Text style={{ color: profit >= 0 ? '#4ade80' : '#f87171', fontSize: 12, fontWeight: '600' }}>
                            {profit >= 0 ? '+' : ''}{profit.toFixed(2)} ({profitPct.toFixed(2)}%)
                          </Text>
                        </View>
                      </View>
                      
                      <View style={[styles.gridRow, { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(148, 163, 184, 0.1)' }]}>
                        <View style={styles.gridItem}>
                          <Text style={styles.statLabel}>Avg Price</Text>
                          <Text style={styles.statValue}>{getCurrency(item.symbol)}{item.average_price?.toFixed(2)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}>
                          <TouchableOpacity onPress={() => {
                            setEditingHolding(item);
                            setEditQty(item.quantity.toString());
                            setEditPrice(item.average_price.toString());
                          }}>
                            <Edit2 size={18} color="#94a3b8" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => deleteHolding(item.symbol)}>
                            <Trash2 size={18} color="#f87171" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </View>
        )}

        {/* Watchlist View */}
        {activeTab === 'watchlist' && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultSymbol}>Watchlist</Text>
            {watchlist.length === 0 ? (
              <View style={[styles.card, { marginTop: 20 }]}>
                <Text style={[styles.subtitle, { padding: 20 }]}>Your watchlist is empty. Search stocks to add them.</Text>
              </View>
            ) : (
                <View style={{ marginTop: 20 }}>
                     {/* Watchlist items mapper would go here */}
                </View>
            )}
          </View>
        )}

        {/* Research Tab - Search & AI Analysis results */}
        {activeTab === 'research' && (
          <View>
            <View style={styles.hero}>
              <Text style={styles.title}>AI Research Hub</Text>
              <Text style={styles.subtitle}>Analyze stocks with institutional grade AI agents.</Text>
            </View>

            <View style={styles.searchSection}>
              <View style={styles.searchContainer}>
                {isSearching ? <ActivityIndicator color="#0ea5e9" size="small" style={styles.searchIcon} /> : <Search size={20} color="#64748b" style={styles.searchIcon} />}
                <TextInput 
                  placeholder="Analyze Company (e.g. Reliance, AAPL)..." 
                  placeholderTextColor="#475569"
                  value={query}
                  onChangeText={setQuery}
                  style={styles.input}
                />
              </View>

              {/* Search Dropdown */}
              {searchResults.length > 0 && (
                <View style={[styles.dropdown, { position: 'absolute', top: 60, left: 20, right: 20, zIndex: 100 }]}>
                  {searchResults.map((result) => (
                    <TouchableOpacity 
                      key={result.symbol} 
                      onPress={() => handleAnalyze(result.symbol)}
                      style={styles.dropdownItem}
                    >
                      <View>
                        <Text style={styles.symbolText}>{result.symbol}</Text>
                        <Text style={styles.nameText} numberOfLines={1}>{result.longname || result.shortname}</Text>
                      </View>
                      <ChevronRight size={16} color="#475569" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Loading Analysis */}
            {isAnalyzing && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0ea5e9" />
                <Text style={styles.loadingText}>Consulting MoE Agents...</Text>
              </View>
            )}

            {/* Analysis Results */}
            {analysis && !isAnalyzing && (
              <View style={styles.resultsContainer}>
                <View style={styles.resultHeader}>
                  <View>
                    <Text style={styles.resultSymbol}>{analysis.symbol}</Text>
                    <View style={[styles.badge, { 
                      backgroundColor: analysis.results.sentiment.label === 'Bullish' ? 'rgba(34, 197, 94, 0.15)' : 
                                       analysis.results.sentiment.label === 'Bearish' ? 'rgba(239, 68, 68, 0.15)' : 
                                       'rgba(148, 163, 184, 0.15)' 
                    }]}>
                      <Text style={[styles.badgeText, { 
                        color: analysis.results.sentiment.label === 'Bullish' ? '#4ade80' : 
                              analysis.results.sentiment.label === 'Bearish' ? '#f87171' : 
                              '#94a3b8' 
                      }]}>
                        {analysis.results.sentiment.label.toUpperCase()} SENTIMENT
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={handleStartAdd} style={styles.convictionBox}>
                    <Text style={styles.convictionLabel}>Add to</Text>
                    <Text style={styles.convictionValue}>Portfolio</Text>
                  </TouchableOpacity>
                </View>

                {/* Technicals */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <BarChart2 size={20} color="#3b82f6" />
                    <Text style={styles.cardTitle}>Technical Summary</Text>
                  </View>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Current Price</Text>
                    <Text style={styles.metricValue}>{getCurrency(analysis.symbol)}{analysis.results.quantitative.technicals.current_price?.toFixed(2)}</Text>
                  </View>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>RSI (Momentum)</Text>
                    <Text style={[styles.metricValue, { color: analysis.results.quantitative.technicals.rsi > 70 ? '#f87171' : '#4ade80' }]}>
                      {analysis.results.quantitative.technicals.rsi?.toFixed(1)}
                    </Text>
                  </View>
                </View>

                {/* Fundamentals */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Shield size={20} color="#10b981" />
                    <Text style={styles.cardTitle}>Efficiency & Valuation</Text>
                  </View>
                  <View style={styles.gridRow}>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>P/E RATIO</Text>
                      <Text style={styles.gridValue}>{analysis.results.quantitative.fundamentals.pe_ratio?.toFixed(1) || 'N/A'}</Text>
                    </View>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>RETURN ON EQUITY</Text>
                      <Text style={styles.gridValue}>{(analysis.results.quantitative.fundamentals.roe * 100)?.toFixed(1)}%</Text>
                    </View>
                  </View>
                </View>

                {/* News */}
                <Text style={styles.sectionTitle}>Agent Pulse: Top Narratives</Text>
                {analysis.results.sentiment.top_headlines && analysis.results.sentiment.top_headlines.slice(0, 3).map((news, idx) => (
                  <TouchableOpacity 
                    key={idx} 
                    onPress={() => news.link && Linking.openURL(news.link)} 
                    style={styles.newsItem}
                  >
                    <Text style={styles.newsPublisher}>{news.publisher || 'Insight'}</Text>
                    <Text style={styles.newsTitle} numberOfLines={2}>{news.title || 'Market Update'}</Text>
                    <ExternalLink size={12} color="#64748b" style={styles.newsIcon} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Indices Feature Summary (Removed in favor of dynamic AI Pulse) */}
      </ScrollView>

      {/* Bottom Tab Navigation */}
      {!isAnalyzing && userPhone && (
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={styles.tabItem} 
            onPress={() => setActiveTab('indices')}
          >
            <BarChart2 size={24} color={activeTab === 'indices' ? '#0ea5e9' : '#64748b'} />
            <Text style={[styles.tabLabel, activeTab === 'indices' && styles.activeTabLabel]}>Indices</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.tabItem} 
            onPress={() => setActiveTab('research')}
          >
            <Search size={24} color={activeTab === 'research' ? '#0ea5e9' : '#64748b'} />
            <Text style={[styles.tabLabel, activeTab === 'research' && styles.activeTabLabel]}>Research</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.tabItem} 
            onPress={() => setActiveTab('watchlist')}
          >
            <Star size={24} color={activeTab === 'watchlist' ? '#0ea5e9' : '#64748b'} />
            <Text style={[styles.tabLabel, activeTab === 'watchlist' && styles.activeTabLabel]}>Watchlist</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.tabItem} 
            onPress={() => {
                setActiveTab('portfolio');
                fetchPortfolio();
            }}
          >
            <Shield size={24} color={activeTab === 'portfolio' ? '#0ea5e9' : '#64748b'} />
            <Text style={[styles.tabLabel, activeTab === 'portfolio' && styles.activeTabLabel]}>Portfolio</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Edit / Add Modal Overlay */}
      {(editingHolding || isAddingToPortfolio) && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {isAddingToPortfolio ? `Add ${analysis?.symbol}` : `Edit ${editingHolding?.symbol}`}
            </Text>
            
            <Text style={styles.gridLabel}>QUANTITY</Text>
            <TextInput 
              style={styles.modalInput}
              keyboardType="numeric"
              value={editQty}
              onChangeText={setEditQty}
            />

            <Text style={styles.gridLabel}>AVERAGE PRICE</Text>
            <TextInput 
              style={styles.modalInput}
              keyboardType="numeric"
              value={editPrice}
              onChangeText={setEditPrice}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                onPress={() => {
                  setEditingHolding(null);
                  setIsAddingToPortfolio(false);
                }} 
                style={[styles.modalButton, { backgroundColor: '#1e293b' }]}
              >
                <Text style={[styles.buttonText, { color: '#fff' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={isAddingToPortfolio ? confirmAddToPortfolio : updateHolding} 
                style={[styles.modalButton, { backgroundColor: '#0ea5e9' }]}
              >
                <Text style={styles.buttonText}>{isAddingToPortfolio ? 'Add' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Angel One Login Modal */}
      {showAngelLogin && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Angel One Sync</Text>
              <TouchableOpacity onPress={() => setShowAngelLogin(false)}>
                <Text style={{ color: '#94a3b8', fontSize: 24, fontWeight: '300' }}>×</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.gridLabel}>CLIENT ID</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. K123456"
              placeholderTextColor="#475569"
              value={angelCreds.client_id}
              onChangeText={(t) => setAngelCreds({...angelCreds, client_id: t})}
              autoCapitalize="characters"
            />

            <Text style={styles.gridLabel}>MPIN</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Your 4-digit PIN"
              placeholderTextColor="#475569"
              value={angelCreds.password}
              onChangeText={(t) => setAngelCreds({...angelCreds, password: t})}
              secureTextEntry
              keyboardType="numeric"
            />

            <Text style={styles.gridLabel}>TOTP SECRET (RECOMMENDED)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Your 32-character Secret"
              placeholderTextColor="#475569"
              value={angelCreds.totp_secret}
              onChangeText={(t) => setAngelCreds({...angelCreds, totp_secret: t})}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[styles.gridLabel, { marginTop: 5 }]}>OR: 6-DIGIT TOTP CODE</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 123456"
              placeholderTextColor="#475569"
              value={angelCreds.totp_code}
              onChangeText={(t) => setAngelCreds({...angelCreds, totp_code: t})}
              keyboardType="numeric"
              maxLength={6}
            />

            <TouchableOpacity 
              style={[styles.authButton, { marginTop: 10 }]}
              onPress={() => syncHoldings('angelone', true)}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.authButtonText}>Connect & Sync</Text>
              )}
            </TouchableOpacity>
            
            <Text style={styles.helperText}>
              Enable 2FA on Angel One to get your TOTP Secret. We'll use it to automate your login sync.
            </Text>
          </View>
        </View>
      )}
      {showBrokerModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Select Broker</Text>
              <TouchableOpacity onPress={() => setShowBrokerModal(false)}>
                <Text style={{ color: '#94a3b8', fontSize: 24, fontWeight: '300' }}>×</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={styles.brokerItem} 
              onPress={() => syncHoldings('angelone')}
            >
              <Shield size={24} color="#0ea5e9" />
              <View style={{ marginLeft: 15 }}>
                <Text style={styles.brokerName}>Angel One</Text>
                <Text style={styles.brokerDesc}>SmartAPI Sync (Needs Credentials)</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.brokerItem} 
              onPress={() => {
                setShowBrokerModal(false);
                Alert.alert("Coming Soon", "Upstox integration is being finalized.");
              }}
            >
              <TrendingUp size={24} color="#4ade80" />
              <View style={{ marginLeft: 15 }}>
                <Text style={styles.brokerName}>Upstox</Text>
                <Text style={styles.brokerDesc}>API V2 Sync (Coming Soon)</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.brokerItem} 
              onPress={() => {
                setShowBrokerModal(false);
                Alert.alert("Coming Soon", "Groww integration is being finalized.");
              }}
            >
              <BarChart2 size={24} color="#f59e0b" />
              <View style={{ marginLeft: 15 }}>
                <Text style={styles.brokerName}>Groww</Text>
                <Text style={styles.brokerDesc}>Trade API Integration (Free)</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleLogout} style={[styles.modalButton, { backgroundColor: '#ef4444', marginTop: 10 }]}>
              <Text style={[styles.buttonText, { color: '#fff' }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Profile Menu Modal */}
      {showProfileModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[styles.logo, { width: 48, height: 48, borderRadius: 24 }]}>
                   <User size={24} color="#fff" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>{userPhone}</Text>
                  <Text style={styles.gridLabel}>PREMIUM ACCOUNT</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowProfileModal(false)}>
                <X size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 10 }}>
              <TouchableOpacity 
                style={styles.brokerItem} 
                onPress={() => { setShowProfileModal(false); setShowBrokerModal(true); }}
              >
                <Shield size={20} color="#0ea5e9" />
                <View style={{ marginLeft: 15 }}>
                  <Text style={styles.brokerName}>Broker Integrations</Text>
                  <Text style={styles.brokerDesc}>Sync your multi-broker accounts</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.brokerItem} 
                onPress={() => { setShowProfileModal(false); setShowSettings(true); }}
              >
                <Settings size={20} color="#94a3b8" />
                <View style={{ marginLeft: 15 }}>
                  <Text style={styles.brokerName}>Settings</Text>
                  <Text style={styles.brokerDesc}>Preferences, Dark Mode, Alerts</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.brokerItem, { borderLeftColor: '#ef4444', borderLeftWidth: 3 }]} 
                onPress={() => { setShowProfileModal(false); handleLogout(); }}
              >
                <LogOut size={20} color="#ef4444" />
                <View style={{ marginLeft: 15 }}>
                  <Text style={[styles.brokerName, { color: '#ef4444' }]}>Logout</Text>
                  <Text style={styles.brokerDesc}>Sign out of your session</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Settings Placeholder Modal */}
      {showSettings && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <X size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <View style={styles.card}>
              <Text style={styles.gridLabel}>APP VERSION</Text>
              <Text style={styles.cardTitle}>v1.0.4 (Experimental)</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.gridLabel}>NOTIFICATIONS</Text>
              <Text style={styles.cardTitle}>Price Alerts (Enabled)</Text>
            </View>
            <TouchableOpacity onPress={() => setShowSettings(false)} style={[styles.modalButton, { backgroundColor: '#0ea5e9', marginTop: 10 }]}>
              <Text style={styles.buttonText}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* History Chart Modal */}
      {showHistoryModal && (
        <Modal
          visible={showHistoryModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowHistoryModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { height: '60%', width: '95%', backgroundColor: '#111827' }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{historySymbol}</Text>
                  <Text style={styles.gridLabel}>30-DAY PRICE TREND</Text>
                </View>
                <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                  <X size={24} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              {isHistoryLoading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#0ea5e9" />
                </View>
              ) : selectedHistory && selectedHistory.length > 0 ? (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={{ marginTop: 20, alignItems: 'center' }}>
                    <LineChart
                      data={{
                        labels: selectedHistory.filter((_, i) => i % 6 === 0).map(h => h.date.split('-')[2]),
                        datasets: [{ data: selectedHistory.map(h => h.price) }]
                      }}
                      width={Dimensions.get('window').width * 0.85}
                      height={180}
                      chartConfig={{
                        backgroundColor: '#111827',
                        backgroundGradientFrom: '#111827',
                        backgroundGradientTo: '#1f2937',
                        decimalPlaces: 2,
                        color: (opacity = 1) => `rgba(14, 165, 233, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
                        style: { borderRadius: 16 },
                        propsForDots: { r: '3', strokeWidth: '1', stroke: '#0ea5e9' }
                      }}
                      bezier
                      style={{ marginVertical: 8, borderRadius: 16 }}
                    />
                  </View>

                  {(() => {
                    const data = getSymbolData(historySymbol);
                    if (!data) return null;
                    return (
                      <View style={{ marginTop: 10 }}>
                        <View style={styles.card}>
                          <Text style={styles.gridLabel}>MARKET STATS</Text>
                          <View style={styles.statRow}>
                            <View>
                              <Text style={styles.statLabel}>Open</Text>
                              <Text style={{ color: '#fff' }}>{data.ohlc.open.toLocaleString()}</Text>
                            </View>
                            <View>
                              <Text style={styles.statLabel}>Prev Close</Text>
                              <Text style={{ color: '#fff' }}>{data.ohlc.prev_close.toLocaleString()}</Text>
                            </View>
                          </View>
                          <View style={[styles.statRow, { marginTop: 10 }]}>
                            <View>
                              <Text style={styles.statLabel}>Day High</Text>
                              <Text style={{ color: '#4ade80' }}>{data.ohlc.high.toLocaleString()}</Text>
                            </View>
                            <View>
                              <Text style={styles.statLabel}>Day Low</Text>
                              <Text style={{ color: '#f87171' }}>{data.ohlc.low.toLocaleString()}</Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.card}>
                          <Text style={styles.gridLabel}>PERFORMANCE RETURNS</Text>
                          <View style={styles.statRow}>
                            <View style={{ alignItems: 'center', flex: 1 }}>
                              <Text style={styles.statLabel}>1 Day</Text>
                              <Text style={{ color: data.returns['1d'] >= 0 ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>
                                {data.returns['1d'] >= 0 ? '+' : ''}{data.returns['1d']}%
                              </Text>
                            </View>
                            <View style={{ alignItems: 'center', flex: 1 }}>
                              <Text style={styles.statLabel}>1 Month</Text>
                              <Text style={{ color: data.returns['1m'] >= 0 ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>
                                {data.returns['1m'] >= 0 ? '+' : ''}{data.returns['1m']}%
                              </Text>
                            </View>
                            <View style={{ alignItems: 'center', flex: 1 }}>
                              <Text style={styles.statLabel}>1 Year</Text>
                              <Text style={{ color: data.returns['1y'] >= 0 ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>
                                {data.returns['1y'] >= 0 ? '+' : ''}{data.returns['1y']}%
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })()}
                </ScrollView>
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: '#94a3b8' }}>No historical data available</Text>
                </View>
              )}
            </View>
          </View>
        </Modal>
      )}

      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  scrollContainer: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  accent: {
    color: '#22d3ee',
  },
  hero: {
    padding: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 22,
  },
  searchSection: {
    paddingHorizontal: 20,
    zIndex: 50,
  },
  searchContainer: {
    width: '100%',
    height: 56,
    backgroundColor: '#121216',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  dropdown: {
    backgroundColor: '#121216',
    borderRadius: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  symbolText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  nameText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
    width: 200,
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 15,
    fontWeight: '600',
  },
  resultsContainer: {
    padding: 20,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 25,
  },
  resultSymbol: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  convictionBox: {
    backgroundColor: '#0ea5e9',
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  convictionLabel: {
    fontSize: 10,
    color: '#000',
    fontWeight: '700',
    opacity: 0.6,
  },
  convictionValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 15,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  metricLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  metricValue: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridItem: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 15,
    borderRadius: 16,
  },
  gridLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '800',
    marginBottom: 5,
  },
  gridValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 15,
    marginBottom: 15,
  },
  newsItem: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 18,
    padding: 15,
    marginBottom: 10,
    position: 'relative',
  },
  newsPublisher: {
    color: '#0ea5e9',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 5,
  },
  newsTitle: {
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 20,
    paddingRight: 20,
  },
  newsIcon: {
    position: 'absolute',
    top: 15,
    right: 15,
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  featureCard: {
    flex: 1,
    marginHorizontal: 5,
    padding: 15,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  featureTitle: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 10,
  },
  tabContainer: {
    height: 70,
    flexDirection: 'row',
    backgroundColor: '#121216',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
    marginTop: 4,
  },
  activeTabLabel: {
    color: '#0ea5e9',
  },
  footer: {
    padding: 20,
    backgroundColor: '#0a0a0c',
  },
  button: {
    backgroundColor: '#fff',
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#121216',
    borderRadius: 24,
    padding: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    color: '#fff',
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
    marginTop: 5,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  authButton: {
    backgroundColor: '#0ea5e9',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: "#0ea5e9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  helperText: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 16,
    paddingHorizontal: 10,
  },
  brokerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  brokerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  brokerDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '800',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
});
