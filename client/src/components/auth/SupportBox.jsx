export default function SupportBox() {
  return (
    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
      <p className="text-xs text-gray-600 text-center font-medium mb-1">
        <strong>Support Contact</strong>
      </p>

      <p className="text-xs text-gray-700 text-center flex justify-center items-center gap-2">
        📧 <span className="font-semibold">helpdesk@braude.ac.il</span>
      </p>

      <p className="text-xs text-gray-700 text-center flex justify-center items-center gap-2 mt-1">
        📞 <span className="font-semibold">052-1234567</span>
      </p>

      <p className="text-[10px] text-gray-500 text-center mt-2">
        For urgent exam-day issues call the number above.
      </p>
    </div>
  );
}
