import { useEffect, useState } from "react";
import { getExams } from "../services/exams.service.js";

export function useExams() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getExams()
      .then(setExams)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { exams, loading, error };
}
