import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import html2canvas from 'html2canvas';
import './App.css';

// --- Constants ---
const MAIN_DECK_LIMIT = 50;
const LIFE_DECK_LIMIT = 5;
const DEFAULT_CARD_LIMIT = 4;

function App() {
  // --- States ---
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mainDeck, setMainDeck] = useState([]);
  const [lifeDeck, setLifeDeck] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false); // Start hidden
  const [isDeckListVisible, setIsDeckListVisible] = useState(false); // Start hidden
  const [deckName, setDeckName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const deckListRef = useRef(null);
  const fileInputRef = useRef(null); // Ref for hidden file input
  const [filters, setFilters] = useState({
    Type: [], Symbol: [], Cost: [], 'C Color': [], Gem: [], 'G Color': [],
  });

  // --- Fetch Cards Effect ---
  useEffect(() => {
    const fetchCards = async () => {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'; // Default to localhost if env var not set
        const response = await axios.get(`${apiUrl}/api/cards`);
        const cleanedData = response.data.data.map(card => ({
          ...card,
          AllowedCopies: card.AllowedCopies === '' ? null : Number(card.AllowedCopies)
        }));
        setCards(cleanedData);
      } catch (error) { console.error("Error fetching card data:", error); }
      finally { setLoading(false); }
    };
    fetchCards();
  }, []);

  // --- Filter Options Logic (Cleaned) ---
  const filterOptions = useMemo(() => {
    const categories = ['Type', 'Symbol', 'Cost', 'C Color', 'Gem', 'G Color'];
    const options = {};
    categories.forEach(category => { options[category] = new Set(); });

    cards.forEach(card => {
      categories.forEach(category => {
        const value = card[category];
        if (value !== '' && value !== undefined && value !== null) {
          const cleanedValue = value.toString().trim();
          if (cleanedValue) {
             if (category === 'Cost' || category === 'Gem') {
               if (!isNaN(cleanedValue)) options[category].add(cleanedValue);
             } else { options[category].add(cleanedValue); }
          }
        }
      });
    });

    return {
      Type: Array.from(options.Type).sort(),
      Symbol: Array.from(options.Symbol).sort(),
      Cost: Array.from(options.Cost).sort((a, b) => Number(a) - Number(b)),
      'C Color': Array.from(options['C Color']).sort(),
      Gem: Array.from(options.Gem).sort((a, b) => Number(a) - Number(b)),
      'G Color': Array.from(options['G Color']).sort(),
    };
  }, [cards]);

  // --- Filter Change Handler ---
  const handleFilterChange = (category, value) => {
    setFilters(prevFilters => {
      const currentValues = prevFilters[category] || [];
      return {
        ...prevFilters,
        [category]: currentValues.includes(value)
          ? currentValues.filter(v => v !== value)
          : [...currentValues, value]
      };
    });
  };

  // --- Card Filtering Logic ---
  const filteredCards = useMemo(() => {
    return cards
      .filter(card =>
        (card.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
         card.RuleName.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      .filter(card => {
        return Object.entries(filters).every(([category, values]) => {
          if (!values || values.length === 0) return true;
          const cardValue = card[category]?.toString().trim();
          return values.includes(cardValue);
        });
      });
  }, [cards, searchTerm, filters]);


  // --- Deck Manipulation Functions ---
  const addCardToDeck = (cardToAdd) => {
    const isLifeCard = cardToAdd.Name.includes('_Life') || cardToAdd.RuleName.includes('_Life');
    if (isLifeCard) {
      addCardToLifeDeck(cardToAdd); // Automatically add to life deck
      return;
    }

    const MEAR_PRA_ISUAN_RULENAME = 'เมียพระอิศวร';
    const THEP_SYMBOL = 'เทพ';
    const AVATAR_TYPE = 'Avatar';
    if (cardToAdd.RuleName === MEAR_PRA_ISUAN_RULENAME) {
      const hasNonThepAvatar = mainDeck.some(
        deckCard => deckCard.Type === AVATAR_TYPE && deckCard.Symbol !== THEP_SYMBOL
      );
      if (hasNonThepAvatar) {
        alert("ไม่สามารถเพิ่ม 'เมียพระอิศวร' ได้ เพราะในเด็คมี Avatar ที่ Symbol ไม่ใช่ 'เทพ' อยู่แล้ว"); return;
      }
    }
    const deckHasMearPraIsuan = mainDeck.some(deckCard => deckCard.RuleName === MEAR_PRA_ISUAN_RULENAME);
    if (deckHasMearPraIsuan && cardToAdd.Type === AVATAR_TYPE) {
      if (cardToAdd.Symbol !== THEP_SYMBOL) {
        alert("เด็คที่มี 'เมียพระอิศวร' สามารถเพิ่มได้เฉพาะ Avatar ที่มี Symbol 'เทพ' เท่านั้น"); return;
      }
    }

    const mainDeckTotal = mainDeck.reduce((total, card) => total + card.count, 0);
    // Only#1 Final Card Check
    if (mainDeckTotal === MAIN_DECK_LIMIT - 1) {
        if (!cardToAdd.is_only_one) {
            const hasOnlyOneAlready = mainDeck.some(card => card.is_only_one);
            if (!hasOnlyOneAlready) {
                alert(`เด็คของคุณยังขาดการ์ด Only#1! การ์ดใบสุดท้าย (ใบที่ 50) ต้องเป็นการ์ด Only#1 เท่านั้น`); return;
            }
        }
    }
    // Deck Limit Check
    if (mainDeckTotal >= MAIN_DECK_LIMIT) {
      alert("Main Deck ของคุณเต็มแล้ว (50 ใบ)"); return;
    }

    // Other Checks (Banlist, Count Limit, Only#1 existing, Group Conflict)
    const cardInDeck = mainDeck.find(card => card.RuleName === cardToAdd.RuleName);
    const currentCount = cardInDeck ? cardInDeck.count : 0;
    const limit = cardToAdd.AllowedCopies !== null ? cardToAdd.AllowedCopies : DEFAULT_CARD_LIMIT;
    if (limit === 0) {
      alert(`การ์ด "${cardToAdd.Name}" ถูกแบน ห้ามใส่ในเด็ค`); return;
    }
    if (currentCount >= limit) {
      alert(`ไม่สามารถเพิ่ม "${cardToAdd.Name}" ได้แล้ว ใส่ได้สูงสุด ${limit} ใบ`); return;
    }
    if (cardToAdd.is_only_one) {
      const hasOnlyOneCard = mainDeck.some(card => card.is_only_one);
      if (hasOnlyOneCard && !cardInDeck) { // Allow increasing count if already in deck
        alert("คุณสามารถใส่การ์ดประเภท Only#1 ได้เพียงใบเดียวในเด็ค"); return;
      }
    }
    if (cardToAdd.RestrictionTypeGroupID) {
        const groupType = cardToAdd.RestrictionTypeGroupID;
        const groupID = cardToAdd.GroupID;
        const hasConflict = mainDeck.some(
            (deckCard) => deckCard.GroupID === groupID && deckCard.RuleName !== cardToAdd.RuleName
        );
        if (hasConflict) {
            if (groupType === 'Choice' || groupType === 'Incompatible') {
                alert(`ไม่สามารถเพิ่ม "${cardToAdd.Name}" ได้ เพราะมีการ์ดอื่นจากกลุ่ม (${groupID}) อยู่ในเด็คแล้ว`); return;
            }
        }
    }

    // Add/Update Card
    setMainDeck(currentDeck => {
      const updatedDeck = [...currentDeck];
      const existingCardIndex = updatedDeck.findIndex(card => card.RuleName === cardToAdd.RuleName);
      if (existingCardIndex > -1) {
        updatedDeck[existingCardIndex] = { ...updatedDeck[existingCardIndex], count: updatedDeck[existingCardIndex].count + 1 };
      } else {
        updatedDeck.push({ ...cardToAdd, count: 1 });
      }
      // Sort after adding/updating
      updatedDeck.sort((a, b) => {
        const typeOrder = ['Only#1', 'Avatar', 'Magic', 'Construct', 'Other']; // Ensure 'Other' is included
        const aGroup = a.is_only_one ? 'Only#1' : (a.Type || 'Other');
        const bGroup = b.is_only_one ? 'Only#1' : (b.Type || 'Other');
        const typeAIndex = typeOrder.indexOf(aGroup);
        const typeBIndex = typeOrder.indexOf(bGroup);
        if (typeAIndex !== typeBIndex) return typeAIndex - typeBIndex;
        if (a.Name < b.Name) return -1;
        if (a.Name > b.Name) return 1;
        return 0;
      });
      return updatedDeck;
    });
  };

  const addCardToLifeDeck = (cardToAdd) => {
    const isLifeCard = cardToAdd.Name.includes('_Life') || cardToAdd.RuleName.includes('_Life');
    if (!isLifeCard) {
      alert(`การ์ด "${cardToAdd.Name}" ไม่ใช่ Life Card จึงไม่สามารถเพิ่มลงใน Life Deck ได้`); return;
    }
    if (lifeDeck.length >= LIFE_DECK_LIMIT) {
      alert("Life Deck ของคุณเต็มแล้ว (5 ใบ)"); return;
    }
    const isDuplicate = lifeDeck.some(card => card.RuleName === cardToAdd.RuleName);
    if (isDuplicate) {
      alert(`การ์ด "${cardToAdd.Name}" มีอยู่ใน Life Deck แล้ว (กฎ Life Deck ห้ามชื่อซ้ำ)`); return;
    }
    setLifeDeck(currentLifeDeck => [...currentLifeDeck, cardToAdd]);
  };

  const removeCardFromMainDeck = (cardToRemove) => {
    setMainDeck(currentDeck => {
      const cardInDeck = currentDeck.find(card => card.RuleName === cardToRemove.RuleName);
      if (!cardInDeck) return currentDeck;
      if (cardInDeck.count > 1) {
        return currentDeck.map(card =>
          card.RuleName === cardToRemove.RuleName
            ? { ...card, count: card.count - 1 } : card
        );
      } else {
        return currentDeck.filter(card => card.RuleName !== cardToRemove.RuleName);
      }
    });
  };

  const removeCardFromLifeDeck = (cardToRemove) => {
    setLifeDeck(currentLifeDeck =>
      currentLifeDeck.filter(card => card.RuleName !== cardToRemove.RuleName)
    );
  };

  const clearAllDecks = () => {
    if (window.confirm("คุณต้องการล้างเด็คทั้งหมดใช่หรือไม่?")) {
      setMainDeck([]);
      setLifeDeck([]);
    }
  };

  // --- Export Functions ---
  const handleExportImage = () => {
    const element = deckListRef.current;
    if (!element) return;
    if (deckName.trim() === '') { alert('กรุณากรอกชื่อเด็คก่อน Export'); return; }
    html2canvas(element, { backgroundColor: '#1e1e1e', useCORS: true })
      .then((canvas) => {
        const image = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = image;
        link.download = `decklist-${deckName.replace(/\s+/g, '_') || 'untitled'}.png`;
        link.click();
      });
  };

  const handleExportTournamentExcel = async () => {
    if (deckName.trim() === '' || playerName.trim() === '') {
      alert('กรุณากรอกชื่อเด็คและชื่อผู้เล่นก่อน Export'); return;
    }
    const mainDeckTotalCheck = mainDeck.reduce((total, card) => total + card.count, 0);
    if (mainDeckTotalCheck !== MAIN_DECK_LIMIT || lifeDeck.length !== LIFE_DECK_LIMIT) {
      alert(`เด็คยังไม่สมบูรณ์! Main Deck ต้องมี ${MAIN_DECK_LIMIT} ใบ และ Life Deck ต้องมี ${LIFE_DECK_LIMIT} ใบ`); return;
    }
    try {
      const deckListData = { deckName, playerName, mainDeck, lifeDeck };
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
      const response = await axios.post(`${apiUrl}/api/generate-tournament-pdf`, deckListData, { responseType: 'blob' });
      const file = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const fileURL = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = fileURL;
      link.setAttribute('download', `decklist_${playerName.replace(/\s+/g, '_') || 'player'}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการ Export Excel:", error);
      alert("ไม่สามารถ Export ไฟล์ Excel ได้ กรุณาตรวจสอบ Console");
    }
  };

  // --- Save/Load Deck Functions ---
  const handleSaveDeck = () => {
    if (!deckName.trim()) { alert("Please enter a deck name before saving."); return; }
    const deckData = { deckName, playerName, mainDeck, lifeDeck };
    const jsonString = JSON.stringify(deckData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${deckName.replace(/\s+/g, '_') || 'talingchan_deck'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const triggerLoadDeck = () => { fileInputRef.current.click(); };
  const handleLoadDeckFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const loadedData = JSON.parse(e.target.result);
        if ( typeof loadedData.deckName === 'string' && typeof loadedData.playerName === 'string' &&
             Array.isArray(loadedData.mainDeck) && Array.isArray(loadedData.lifeDeck) )
        {
          setDeckName(loadedData.deckName);
          setPlayerName(loadedData.playerName);
          setMainDeck(loadedData.mainDeck);
          setLifeDeck(loadedData.lifeDeck);
          alert(`Deck "${loadedData.deckName}" loaded successfully!`);
        } else { throw new Error("Invalid deck file structure."); }
      } catch (error) {
        console.error("Error loading deck file:", error);
        alert("Failed to load deck file. Ensure it's a valid JSON deck file.");
      } finally { event.target.value = null; }
    };
    reader.onerror = (e) => { console.error("Error reading file:", e); alert("Error reading the selected file."); event.target.value = null; };
    reader.readAsText(file);
  };


  // --- Deck Rendering Logic ---
  const mainDeckTotal = mainDeck.reduce((total, card) => total + card.count, 0);
  const getGroupedDeck = () => {
    return mainDeck.reduce((acc, card) => {
      let group = 'Other';
      if (card.is_only_one) { group = 'Only#1'; }
      else if (card.Type) { group = card.Type; }
      if (!acc[group]) acc[group] = [];
      acc[group].push(card);
      return acc;
    }, {});
   };
  const groupedDeckData = getGroupedDeck();
  const groupOrder = ['Only#1', 'Avatar', 'Magic', 'Construct']; // Define group display order

  const renderCardGroup = (groupName, isPrintable = false) => {
    const groupCards = groupedDeckData[groupName];
    if (!groupCards || groupCards.length === 0) return null;
    const groupTotal = groupCards.reduce((total, card) => total + card.count, 0);
    return (
      <div key={groupName} className="deck-card-group">
        <h4 className="group-header">{groupName} ({groupTotal})</h4>
        {groupCards.map((card, index) => (
          <div key={`${card.RuleName}-${index}-${card.count}`} className="deck-card-item"> {/* Improved key */}
            {card.image_url && <img src={card.image_url} alt={card.Name} className="deck-card-thumbnail" />}
            <span className="deck-card-count">x{card.count}</span>
            <span className="deck-card-name">{card.Name}</span>
            {!isPrintable && (
              <button onClick={() => removeCardFromMainDeck(card)} className="delete-card-btn hide-on-print">
                🗑️
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  // --- Component Return ---
  return (
    <div className="app-container">
      {(isFilterVisible || isDeckListVisible) && <div className="backdrop" onClick={() => { setIsFilterVisible(false); setIsDeckListVisible(false); }}></div>}
      <div className="main-content">
        <div className={`filter-wrapper ${isFilterVisible ? 'visible' : 'hidden'}`}>
            <button className="close-sidebar-btn" onClick={() => setIsFilterVisible(false)}>×</button>
            <h2 className="filter-main-title">Filter Options</h2>
            <div className="filter-panel">
            {Object.entries(filterOptions).map(([category, options]) => (
              options.length > 0 && (
                <div key={category} className="filter-group">
                  <h3 className="filter-title">{category.replace('_', ' ')}</h3>
                  <div className="filter-options">
                    {options.map(option => (
                      <label key={option} className="filter-label">
                        <input type="checkbox" checked={filters[category]?.includes(option)} onChange={() => handleFilterChange(category, option)} />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>

        <div className="card-gallery-wrapper">
          <header className="app-header">
             <div className="header-buttons">
                <button className="toggle-button" onClick={() => setIsFilterVisible(!isFilterVisible)}>Filter</button>
                <button className="toggle-button" onClick={() => setIsDeckListVisible(!isDeckListVisible)}>Deck List</button>
             </div>
            <h1>Battle of Talingchan Deck Builder</h1>
            <input type="text" placeholder="ค้นหาการ์ดด้วยชื่อ..." className="search-bar" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </header>
          <main className="card-gallery">
            {loading ? <p>Loading cards...</p> : (
              filteredCards.map((card, index) => (
                <div key={`${card.RuleName}-${index}`} className="card-container" onClick={() => addCardToDeck(card)} onContextMenu={(e) => { e.preventDefault(); addCardToLifeDeck(card); }}>
                  <img src={card.image_url} alt={card.Name} className="card-image" />
                </div>
              ))
            )}
          </main>
        </div>

        <div className={`deck-list-wrapper ${isDeckListVisible ? 'visible' : 'hidden'}`}>
            <button className="close-sidebar-btn" onClick={() => setIsDeckListVisible(false)}>×</button>
            <div className="deck-list-content">
              <input type="text" className="deck-name-input" placeholder="กรอกชื่อเด็ค..." value={deckName} onChange={(e) => setDeckName(e.target.value)} />
              <input type="text" className="deck-name-input" placeholder="กรอกชื่อผู้เล่น..." value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
              <div className="deck-actions button-row">
                <button onClick={handleSaveDeck} className="save-deck-btn">Save Deck 💾</button>
                <button onClick={triggerLoadDeck} className="load-deck-btn">Load Deck 📂</button>
              </div>
              <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".json" onChange={handleLoadDeckFile} />
              <div className="deck-actions button-row">
                <button onClick={clearAllDecks} className="clear-deck-btn">Clear All 🗑️</button>
                <button onClick={handleExportImage} className="export-image-btn">Export Image 📸</button>
              </div>
              <div className="deck-actions button-row">
                  <button onClick={handleExportTournamentExcel} className="export-pdf-btn">Export for Tournament 📜</button>
              </div>
              <div className="deck-section">
                <div className="deck-header">Main Deck ({mainDeckTotal} / {MAIN_DECK_LIMIT})</div>
                <div className="deck-card-list">
                  {groupOrder.map(groupName => renderCardGroup(groupName))}
                </div>
              </div>
              <div className="deck-section">
                <div className="deck-header">Life Deck ({lifeDeck.length} / {LIFE_DECK_LIMIT})</div>
                <div className="deck-card-list">
                  {lifeDeck.map((card, index) => (
                    <div key={`${card.RuleName}-${index}`} className="deck-card-item">
                      {card.image_url && <img src={card.image_url} alt={card.Name} className="deck-card-thumbnail" />}
                      <span className="deck-card-count">x1</span>
                      <span className="deck-card-name">{card.Name}</span>
                      <button onClick={() => removeCardFromLifeDeck(card)} className="delete-card-btn hide-on-print">🗑️</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
        </div>
      </div>

      <div className="printable-area-container" ref={deckListRef}>
        <div className="printable-header"> <h2>{deckName || 'Deck List'}</h2> </div>
        <div className="printable-content-grid">
          <div className="printable-group-column"> {renderCardGroup('Only#1', true)} {renderCardGroup('Avatar', true)} </div>
          <div className="printable-group-column"> {renderCardGroup('Magic', true)} {renderCardGroup('Construct', true)} </div>
          <div className="printable-group-column">
            <div className="deck-card-group">
                <h4 className="group-header">Life Deck ({lifeDeck.length})</h4>
                {lifeDeck.map((card, index) => (
                  <div key={`${card.RuleName}-${index}`} className="deck-card-item">
                    {card.image_url && <img src={card.image_url} alt={card.Name} className="deck-card-thumbnail" />}
                    <span className="deck-card-count">x1</span> <span className="deck-card-name">{card.Name}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;