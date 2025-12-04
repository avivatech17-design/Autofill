import { useState, useEffect, useRef } from 'react';

export default function Autocomplete({ options, value, onChange, placeholder, disabled }) {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value || '');
    const [filteredOptions, setFilteredOptions] = useState([]);
    const wrapperRef = useRef(null);

    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInputValue(val);
        setIsOpen(true);

        if (!val) {
            setFilteredOptions([]);
            return;
        }

        const filtered = options.filter(option =>
            option.toLowerCase().includes(val.toLowerCase())
        ).slice(0, 10);

        setFilteredOptions(filtered);
    };

    const handleSelect = (val) => {
        setInputValue(val);
        onChange(val);
        setIsOpen(false);
    };

    const showCreateOption = inputValue && !options.some(opt => opt.toLowerCase() === inputValue.toLowerCase());

    return (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
            <input
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => setIsOpen(true)}
                placeholder={placeholder}
                disabled={disabled}
                style={{ width: '100%' }}
            />
            {isOpen && inputValue && (
                <ul style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                    {filteredOptions.map((option) => (
                        <li
                            key={option}
                            onClick={() => handleSelect(option)}
                            style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #eee',
                                color: '#333'
                            }}
                            onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
                            onMouseLeave={(e) => e.target.style.background = 'white'}
                        >
                            {option}
                        </li>
                    ))}
                    {showCreateOption && (
                        <li
                            onClick={() => handleSelect(inputValue)}
                            style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                color: 'var(--primary-color)',
                                fontWeight: '500',
                                borderTop: filteredOptions.length > 0 ? '1px solid #eee' : 'none'
                            }}
                            onMouseEnter={(e) => e.target.style.background = '#f0f9ff'}
                            onMouseLeave={(e) => e.target.style.background = 'white'}
                        >
                            Create "{inputValue}"
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}
