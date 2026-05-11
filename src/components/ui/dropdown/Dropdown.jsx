import { useEffect, useRef, useState } from "react";

import styles from "./Dropdown.module.css";

function Dropdown({
  options = [],
  value,
  onChange,
  placeholder = "Select...",
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const dropdownRef = useRef();

  const filteredOptions = options.filter((option) =>
    option.label
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    window.addEventListener("click", handleOutsideClick);

    return () => {
      window.removeEventListener(
        "click",
        handleOutsideClick
      );
    };
  }, []);

  const selectedOption = options.find(
    (option) => option.value === value
  );

  const handleSelect = (option) => {
    onChange(option.value);

    setOpen(false);
    setSearch("");
  };

  return (
    <div
      className={styles.dropdown}
      ref={dropdownRef}
    >
      <div
        className={styles.control}
        onClick={() => setOpen((prev) => !prev)}
      >
        {selectedOption?.label || placeholder}
      </div>

      {open && (
        <div className={styles.menu}>
          <input
            className={styles.search}
            placeholder="Search..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />

          <div className={styles.options}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={styles.option}
                  onClick={() =>
                    handleSelect(option)
                  }
                >
                  {option.label}
                </div>
              ))
            ) : (
              <div className={styles.empty}>
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dropdown;