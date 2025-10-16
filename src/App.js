import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import html2canvas from 'html2canvas';
import './App.css';

// --- ค่าคงที่สำหรับกฎของเกม ---
const MAIN_DECK_LIMIT = 50;
const LIFE_DECK_LIMIT = 5;
const DEFAULT_CARD_LIMIT = 4;

function App() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mainDeck, setMainDeck] = useState([]);
  const [lifeDeck, setLifeDeck] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isFilterVisible, setIsFilterVisible] = useState(true);
  const [isDeckListVisible, setIsDeckListVisible] = useState(true);

  const [deckName, setDeckName] = useState('');
  // --- NEW: State สำหรับชื่อผู้เล่น ---
  const [playerName, setPlayerName] = useState('');
  
  const deckListRef = useRef(null);

  const [filters, setFilters] = useState({
    Type: [],
    Symbol: [],
    Cost: [],
    'C Color': [],
    Gem: [],
    'G Color': [],
  });

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/cards`);
        const cleanedData = response.data.data.map(card => ({
          ...card,
          AllowedCopies: card.AllowedCopies === '' ? null : Number(card.AllowedCopies)
        }));
        setCards(cleanedData);
      } catch (error) {
        console.error("Error fetching card data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCards();
  }, []);
  
  const filterOptions = useMemo(() => {
    const options = {
      Type: new Set(),
      Symbol: new Set(),
      Cost: new Set(),
      'C Color': new Set(),
      Gem: new Set(),
      'G Color': new Set(),
    };
    cards.forEach(card => {
      Object.keys(options).forEach(key => {
        if (card[key] !== '' && card[key] !== undefined) {
          options[key].add(card[key]);
        }
      });
    });
    return {
      Type: Array.from(options.Type).sort(),
      Symbol: Array.from(options.Symbol).sort(),
      Cost: Array.from(options.Cost).sort((a, b) => a - b),
      'C Color': Array.from(options['C Color']).sort(),
      Gem: Array.from(options.Gem).sort((a, b) => a - b),
      'G Color': Array.from(options['G Color']).sort(),
    };
  }, [cards]);

  const handleFilterChange = (category, value) => {
    setFilters(prevFilters => {
      const currentValues = prevFilters[category];
      if (currentValues.includes(value)) {
        return { ...prevFilters, [category]: currentValues.filter(v => v !== value) };
      } else {
        return { ...prevFilters, [category]: [...currentValues, value] };
      }
    });
  };

  const filteredCards = useMemo(() => {
    return cards
      .filter(card => 
        (card.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
         card.RuleName.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      .filter(card => {
        return Object.entries(filters).every(([category, values]) => {
          if (values.length === 0) {
            return true;
          }
          return values.includes(card[category]);
        });
      });
  }, [cards, searchTerm, filters]);


  const addCardToDeck = (cardToAdd) => {
    const isLifeCard = cardToAdd.Name.includes('_Life') || cardToAdd.RuleName.includes('_Life');
    if (isLifeCard) {
      alert("การ์ดประเภท Life สามารถเพิ่มลงใน Life Deck ได้เท่านั้น (โดยการคลิกขวา)");
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
        alert("ไม่สามารถเพิ่ม 'เมียพระอิศวร' ได้ เพราะในเด็คมี Avatar ที่ Symbol ไม่ใช่ 'เทพ' อยู่แล้ว");
        return;
      }
    }
    const deckHasMearPraIsuan = mainDeck.some(deckCard => deckCard.RuleName === MEAR_PRA_ISUAN_RULENAME);
    if (deckHasMearPraIsuan && cardToAdd.Type === AVATAR_TYPE) {
      if (cardToAdd.Symbol !== THEP_SYMBOL) {
        alert("เด็คที่มี 'เมียพระอิศวร' สามารถเพิ่มได้เฉพาะ Avatar ที่มี Symbol 'เทพ' เท่านั้น");
        return;
      }
    }
    const mainDeckTotal = mainDeck.reduce((total, card) => total + card.count, 0);
    const cardInDeck = mainDeck.find(card => card.RuleName === cardToAdd.RuleName);
    const currentCount = cardInDeck ? cardInDeck.count : 0;
    if (mainDeckTotal >= MAIN_DECK_LIMIT) {
      alert("Main Deck ของคุณเต็มแล้ว (50 ใบ)");
      return;
    }
    const limit = cardToAdd.AllowedCopies !== null ? cardToAdd.AllowedCopies : DEFAULT_CARD_LIMIT;
    if (limit === 0) {
      alert(`การ์ด "${cardToAdd.Name}" ถูกแบน ห้ามใส่ในเด็ค`);
      return;
    }
    if (currentCount >= limit) {
      alert(`ไม่สามารถเพิ่ม "${cardToAdd.Name}" ได้แล้ว ใส่ได้สูงสุด ${limit} ใบ`);
      return;
    }
    if (cardToAdd.is_only_one) {
      const hasOnlyOneCard = mainDeck.some(card => card.is_only_one);
      if (hasOnlyOneCard) {
        alert("คุณสามารถใส่การ์ดประเภท Only#1 ได้เพียงใบเดียวในเด็ค");
        return;
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
                alert(`ไม่สามารถเพิ่ม "${cardToAdd.Name}" ได้ เพราะมีการ์ดอื่นจากกลุ่ม (${groupID}) อยู่ในเด็คแล้ว`);
                return;
            }
        }
    }
    setMainDeck(currentDeck => {
      const sortedDeck = [...currentDeck];
      const existingCardIndex = sortedDeck.findIndex(card => card.RuleName === cardToAdd.RuleName);

      if (existingCardIndex > -1) {
        sortedDeck[existingCardIndex].count++;
      } else {
        sortedDeck.push({ ...cardToAdd, count: 1 });
      }
      sortedDeck.sort((a, b) => {
        if (a.Type < b.Type) return -1;
        if (a.Type > b.Type) return 1;
        if (a.Name < b.Name) return -1;
        if (a.Name > b.Name) return 1;
        return 0;
      });
      return sortedDeck;
    });
  };

  const addCardToLifeDeck = (cardToAdd) => {
    const isLifeCard = cardToAdd.Name.includes('_Life') || cardToAdd.RuleName.includes('_Life');
    if (!isLifeCard) {
      alert(`การ์ด "${cardToAdd.Name}" ไม่ใช่ Life Card จึงไม่สามารถเพิ่มลงใน Life Deck ได้`);
      return;
    }
    if (lifeDeck.length >= LIFE_DECK_LIMIT) {
      alert("Life Deck ของคุณเต็มแล้ว (5 ใบ)");
      return;
    }
    const isDuplicate = lifeDeck.some(card => card.RuleName === cardToAdd.RuleName);
    if (isDuplicate) {
      alert(`การ์ด "${cardToAdd.Name}" มีอยู่ใน Life Deck แล้ว (กฎ Life Deck ห้ามชื่อซ้ำ)`);
      return;
    }
    setLifeDeck(currentLifeDeck => [...currentLifeDeck, cardToAdd]);
  };
  
  const removeCardFromMainDeck = (cardToRemove) => {
    setMainDeck(currentDeck => {
      const cardInDeck = currentDeck.find(card => card.RuleName === cardToRemove.RuleName);
      if (cardInDeck.count > 1) {
        return currentDeck.map(card => 
          card.RuleName === cardToRemove.RuleName 
            ? { ...card, count: card.count - 1 } 
            : card
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

  const handleExportImage = () => {
    const element = deckListRef.current;
    if (!element) return;
    if (deckName.trim() === '') {
        alert('กรุณากรอกชื่อเด็คก่อน Export');
        return;
    }
    html2canvas(element, {
      backgroundColor: '#1e1e1e',
      useCORS: true 
    }).then((canvas) => {
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `decklist-${deckName.replace(/\s+/g, '_')}.png`;
      link.click();
    });
  };

  // --- NEW: ฟังก์ชันสำหรับ Export PDF งานแข่ง ---
  const handleExportTournamentPDF = async () => {
    if (deckName.trim() === '' || playerName.trim() === '') {
      alert('กรุณากรอกชื่อเด็คและชื่อผู้เล่นก่อน Export PDF');
      return;
    }
    if (mainDeckTotal !== MAIN_DECK_LIMIT || lifeDeck.length !== LIFE_DECK_LIMIT) {
      alert(`เด็คยังไม่สมบูรณ์! Main Deck ต้องมี ${MAIN_DECK_LIMIT} ใบ และ Life Deck ต้องมี ${LIFE_DECK_LIMIT} ใบ`);
      return;
    }

    try {
      const deckListData = {
        deckName: deckName,
        playerName: playerName,
        mainDeck: mainDeck,
        lifeDeck: lifeDeck,
      };

      const response = await axios.post('http://127.0.0.1:8000/api/generate-tournament-pdf', deckListData, {
        responseType: 'blob',
      });
      
      const file = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);
      
      const link = document.createElement('a');
      link.href = fileURL;
      link.setAttribute('download', `decklist_${playerName.replace(/\s+/g, '_')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);

    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการ Export PDF:", error);
      alert("ไม่สามารถสร้างไฟล์ PDF ได้ กรุณาตรวจสอบ Console");
    }
  };


  const mainDeckTotal = mainDeck.reduce((total, card) => total + card.count, 0);
  
  const getGroupedDeck = () => {
    return mainDeck.reduce((acc, card) => {
      let group = 'Other';
      if (card.is_only_one) {
        group = 'Only#1';
      } else if (card.Type) {
        group = card.Type;
      }
      
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(card);
      return acc;
    }, {});
  };

  const groupedDeckData = getGroupedDeck();
  const groupOrder = ['Only#1', 'Avatar', 'Magic', 'Construct'];

  const renderCardGroup = (groupName, isPrintable = false) => {
    const groupCards = groupedDeckData[groupName];
    if (!groupCards || groupCards.length === 0) return null;

    const groupTotal = groupCards.reduce((total, card) => total + card.count, 0);

    return (
      <div key={groupName} className="deck-card-group">
        <h4 className="group-header">{groupName} ({groupTotal})</h4>
        {groupCards.map((card, index) => (
          <div key={`${card.RuleName}-${index}`} className="deck-card-item">
            {card.image_url && <img src={card.image_url} alt={card.Name} className="deck-card-thumbnail" />}
            <span className="deck-card-count">x{card.count}</span>
            <span className="deck-card-name">{card.Name}</span>
            {!isPrintable && (
              <button onClick={() => removeCardFromMainDeck(card)} className="delete-card-btn">
                🗑️
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <div className="app-container">
      <div className="main-content">
        
        <div className={`filter-wrapper ${isFilterVisible ? 'visible' : 'hidden'}`}>
          <h2 className="filter-main-title">Filter Options</h2>
          <div className="filter-panel">
            {Object.entries(filterOptions).map(([category, options]) => (
              <div key={category} className="filter-group">
                <h3 className="filter-title">{category}</h3>
                <div className="filter-options">
                  {options.map(option => (
                    <label key={option} className="filter-label">
                      <input type="checkbox" checked={filters[category].includes(option)} onChange={() => handleFilterChange(category, option)} />
                      {option}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-gallery-wrapper">
          <header className="app-header">
            <button className="filter-toggle-btn" onClick={() => setIsFilterVisible(!isFilterVisible)}>
              {isFilterVisible ? '❮' : '❯'}
            </button>
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
          <button className="decklist-toggle-btn" onClick={() => setIsDeckListVisible(!isDeckListVisible)}>
            {isDeckListVisible ? '❯' : '❮'}
          </button>
          
          <div className="deck-list-content">
            <input type="text" className="deck-name-input" placeholder="กรอกชื่อเด็ค..." value={deckName} onChange={(e) => setDeckName(e.target.value)} />
            {/* --- NEW: Input สำหรับชื่อผู้เล่น --- */}
            <input type="text" className="deck-name-input" placeholder="กรอกชื่อผู้เล่น..." value={playerName} onChange={(e) => setPlayerName(e.target.value)} />

            <div className="deck-actions">
              <button onClick={clearAllDecks} className="clear-deck-btn">
                Clear All 🗑️
              </button>
              <button onClick={handleExportImage} className="export-image-btn">
                Export Image 📸
              </button>
            </div>

            {/* --- NEW: ปุ่ม Export PDF --- */}
            <div className="deck-actions">
              <button onClick={handleExportTournamentPDF} className="export-pdf-btn" disabled>
                Export PDF for Tournament 📜
              </button>
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
                    <button onClick={() => removeCardFromLifeDeck(card)} className="delete-card-btn">🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="printable-area-container" ref={deckListRef}>
        <div className="printable-header">
          <h2>{deckName || 'Deck List'}</h2>
        </div>
        <div className="printable-content-grid">
          <div className="printable-group-column">
            {renderCardGroup('Only#1', true)}
            {renderCardGroup('Avatar', true)}
          </div>
          <div className="printable-group-column">
            {renderCardGroup('Magic', true)}
            {renderCardGroup('Construct', true)}
          </div>
          <div className="printable-group-column">
            <div className="deck-card-group">
                <h4 className="group-header">Life Deck ({lifeDeck.length})</h4>
                {lifeDeck.map((card, index) => (
                  <div key={`${card.RuleName}-${index}`} className="deck-card-item">
                    {card.image_url && <img src={card.image_url} alt={card.Name} className="deck-card-thumbnail" />}
                    <span className="deck-card-count">x1</span>
                    <span className="deck-card-name">{card.Name}</span>
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