import React, { useState, useEffect } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isSameDay,
  parseISO,
} from 'date-fns';

import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import './App.css';

const ItemTypes = { EVENT: 'event' };

function DraggableEvent({ event, onEventClick }) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.EVENT,
    item: { id: event.id },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag}
      className="event"
      style={{ backgroundColor: event.color || '#007bff', opacity: isDragging ? 0.5 : 1 }}
      onClick={(e) => onEventClick(event, e)}
    >
      {event.title}
    </div>
  );
}

function DropCell({ day, children, onDrop }) {
  const [, drop] = useDrop({
    accept: ItemTypes.EVENT,
    drop: (item) => onDrop(item.id, day),
  });

  return (
    <div ref={drop} className="col cell">
      {children}
    </div>
  );
}

function App() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState(() => {
    const saved = localStorage.getItem('events');
    return saved ? JSON.parse(saved) : [];
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState(null);
  const [modalEvent, setModalEvent] = useState(null);
  const [recurrenceType, setRecurrenceType] = useState('none');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    localStorage.setItem('events', JSON.stringify(events));
  }, [events]);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const onDateClick = (day) => {
    setModalDate(day);
    setModalEvent(null);
    setRecurrenceType('none');
    setModalOpen(true);
  };

  const onEventClick = (event, e) => {
    e.stopPropagation();
    setModalEvent(event);
    setModalDate(parseISO(event.date));
    setRecurrenceType(event.recurrence?.type || 'none');
    setModalOpen(true);
  };

  const onDrop = (id, newDate) => {
    setEvents((prev) =>
      prev.map((ev) => (ev.id === id ? { ...ev, date: newDate.toISOString() } : ev))
    );
  };

  const hasConflict = (newEvent) => {
    return events.some((ev) => {
      if (ev.id === newEvent.id) return false;
      return newEvent.date === ev.date;
    });
  };

  const handleDelete = () => {
    if (modalEvent) {
      setEvents((prev) => prev.filter((ev) => ev.id !== modalEvent.id));
      setModalOpen(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    const title = form.title.value.trim();
    const description = form.description.value.trim();
    const date = form.date.value;
    const color = form.color.value;
    const recurrenceTypeValue = form.recurrenceType.value;

    if (!title) {
      alert('Title is required');
      return;
    }

    let recurrence = { type: recurrenceTypeValue };

    if (recurrenceTypeValue === 'weekly') {
      const checkedDays = Array.from(form.weekDays)
        .filter((input) => input.checked)
        .map((input) => Number(input.value));
      recurrence.daysOfWeek = checkedDays.length > 0 ? checkedDays : [new Date(date).getDay()];
    }

    if (recurrenceTypeValue === 'custom') {
      const interval = parseInt(form.customInterval.value, 10);
      recurrence.interval = interval > 1 ? interval : 1;
    }

    if (recurrenceTypeValue === 'none') {
      recurrence = { type: 'none' };
    }

    const newEvent = {
      id: modalEvent ? modalEvent.id : Date.now(),
      title,
      description,
      date,
      color,
      recurrence,
    };

    if (hasConflict(newEvent)) {
      alert('Event conflicts with an existing event.');
      return;
    }

    if (modalEvent) {
      setEvents((prev) =>
        prev.map((ev) => (ev.id === modalEvent.id ? newEvent : ev))
      );
    } else {
      setEvents((prev) => [...prev, newEvent]);
    }

    setModalOpen(false);
  };

  const renderHeader = () => (
    <div className="header row flex-middle">
      <div className="col col-start">
        <button onClick={prevMonth}>❮</button>
      </div>
      <div className="col col-center">
        <span>{format(currentMonth, 'MMMM yyyy')}</span>
      </div>
      <div className="col col-end">
        <button onClick={nextMonth}>❯</button>
      </div>
    </div>
  );

  const renderDays = () => {
    const days = [];
    const startDate = startOfWeek(currentMonth);

    for (let i = 0; i < 7; i++) {
      days.push(
        <div className="col col-center" key={i}>
          {format(addDays(startDate, i), 'EEE')}
        </div>
      );
    }

    return <div className="days row">{days}</div>;
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const formattedDate = format(day, 'd');
        const cloneDay = day;

        const dayEvents = events.filter((event) => {
          const eventDate = parseISO(event.date);

          if (event.recurrence?.type === 'none' || !event.recurrence) {
            return isSameDay(eventDate, cloneDay);
          }

          const recType = event.recurrence.type;

          if (recType === 'daily') {
            return cloneDay >= eventDate;
          }

          if (recType === 'weekly') {
            const daysOfWeek = event.recurrence.daysOfWeek || [];
            return cloneDay >= eventDate && daysOfWeek.includes(cloneDay.getDay());
          }

          if (recType === 'monthly') {
            return cloneDay >= eventDate && cloneDay.getDate() === eventDate.getDate();
          }

          if (recType === 'custom') {
            const interval = event.recurrence.interval || 2;
            const weeksDiff = Math.floor((cloneDay - eventDate) / (1000 * 60 * 60 * 24 * 7));
            return weeksDiff % interval === 0 && cloneDay >= eventDate;
          }

          return isSameDay(eventDate, cloneDay);
        });

        const filteredEvents = dayEvents.filter((event) =>
          event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          event.description?.toLowerCase().includes(searchTerm.toLowerCase())
        );

        days.push(
          <DropCell key={day} day={cloneDay} onDrop={onDrop}>
            <div
              className={`cell ${
                !isSameMonth(day, monthStart)
                  ? 'disabled'
                  : isSameDay(day, new Date())
                  ? 'selected'
                  : ''
              }`}
              onClick={() => onDateClick(cloneDay)}
            >
              <span className="number">{formattedDate}</span>
              <div className="events">
                {filteredEvents.map((event) => (
                  <DraggableEvent key={event.id} event={event} onEventClick={onEventClick} />
                ))}
              </div>
            </div>
          </DropCell>
        );

        day = addDays(day, 1);
      }

      rows.push(
        <div className="row" key={day}>
          {days}
        </div>
      );

      days = [];
    }

    return <div className="body">{rows}</div>;
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="calendar">
        <input
          type="text"
          placeholder="Search events..."
          className="search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {renderHeader()}
        {renderDays()}
        {renderCells()}

        {modalOpen && (
          <div className="modal-overlay" onClick={() => setModalOpen(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>{modalEvent ? 'Edit Event' : 'Add Event'}</h2>
              <form onSubmit={handleSubmit}>
                <label>
                  Title:
                  <input name="title" defaultValue={modalEvent?.title || ''} required />
                </label>

                <label>
                  Description:
                  <textarea name="description" defaultValue={modalEvent?.description} />
                </label>

                <label>
                  Date & Time:
                  <input
                    type="datetime-local"
                    name="date"
                    defaultValue={modalDate ? new Date(modalDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)}
                    required
                  />
                </label>

                <label>
                  Color:
                  <input type="color" name="color" defaultValue={modalEvent?.color || '#007bff'} />
                </label>

                <label>
                  Recurrence:
                  <select
                    name="recurrenceType"
                    defaultValue={modalEvent?.recurrence?.type || 'none'}
                    onChange={(e) => setRecurrenceType(e.target.value)}
                  >
                    <option value="none">None</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>

                {recurrenceType === 'weekly' && (
                  <div className="weekly-days">
                    {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                      <label key={day}>
                        <input
                          type="checkbox"
                          name="weekDays"
                          value={day}
                          defaultChecked={modalEvent?.recurrence?.daysOfWeek?.includes(day) || false}
                        />
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]}
                      </label>
                    ))}
                  </div>
                )}

                {recurrenceType === 'custom' && (
                  <label>
                    Repeat every
                    <input
                      type="number"
                      name="customInterval"
                      min="1"
                      defaultValue={modalEvent?.recurrence?.interval || 2}
                      style={{ marginLeft: '5px', width: '60px' }}
                    />
                    weeks
                  </label>
                )}

                <div className="modal-buttons">
                  <button type="submit">{modalEvent ? 'Update' : 'Add'}</button>
                  <button type="button" onClick={() => setModalOpen(false)} className="cancel-btn">
                    Cancel
                  </button>
                  {modalEvent && (
                    <button type="button" onClick={handleDelete} className="delete-btn">
                      Delete
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DndProvider>
  );
}

export default App;
