"""Lightweight deterministic personalization engine for OpportunityOS.

Calculates a relevance_score (0-100) comparing a student profile against
an opportunity without invoking slow/costly LLMs or CrewAI.
"""

import re
from typing import Any, Dict, List, Optional


def tokenize_set(items: Optional[List[str]]) -> set[str]:
    """Normalize a list of strings into lowercase tokens."""
    if not items:
        return set()
    tokens = set()
    for item in items:
        if isinstance(item, str):
            # Add full string normalized
            tokens.add(item.strip().lower())
            # Add individual alphanumeric words
            for word in re.findall(r"\b[a-zA-Z0-9+#.]+\b", item.lower()):
                if len(word) > 1:
                    tokens.add(word)
    return tokens


def calculate_relevance_score(profile: Dict[str, Any], opportunity: Dict[str, Any]) -> int:
    """
    Calculate deterministic relevance score (0-100) between user profile and opportunity.
    Component weights:
    - Opportunity type match: up to 25 pts
    - Skills match: up to 35 pts
    - Interests match: up to 20 pts
    - Background/degree/branch match: up to 20 pts
    """
    if not profile or not opportunity:
        return 0

    score = 0.0

    # 1. Preferred Opportunity Types (25 pts)
    pref_types = [t.strip().lower() for t in (profile.get("preferred_opportunity_types") or []) if isinstance(t, str)]
    opp_type = str(opportunity.get("opportunity_type") or opportunity.get("type", "")).strip().lower()
    if pref_types:
        if opp_type in pref_types:
            score += 25.0
        elif any(pt in opp_type or opp_type in pt for pt in pref_types):
            score += 15.0
    else:
        # Neutral if no preference selected
        score += 12.0

    # 2. Skills Match (35 pts)
    user_skills = tokenize_set(profile.get("skills"))
    opp_skills = tokenize_set(opportunity.get("required_skills"))
    
    # Also check if user skills appear in title or description
    text_corpus = f"{opportunity.get('title', '')} {opportunity.get('description', '')}".lower()

    if user_skills:
        skill_hits = 0
        total_eval = max(len(opp_skills), 3)

        for skill in user_skills:
            if skill in opp_skills:
                skill_hits += 2
            elif re.search(r"\b" + re.escape(skill) + r"\b", text_corpus):
                skill_hits += 1

        skill_ratio = min(skill_hits / total_eval, 1.0)
        score += skill_ratio * 35.0
    else:
        score += 5.0

    # 3. Interests Match (20 pts)
    user_interests = tokenize_set(profile.get("interests"))
    if user_interests:
        interest_hits = sum(1 for interest in user_interests if re.search(r"\b" + re.escape(interest) + r"\b", text_corpus))
        interest_ratio = min(interest_hits / max(len(user_interests), 1), 1.0)
        score += interest_ratio * 20.0
    else:
        score += 5.0

    # 4. Background / Degree / Branch / Eligibility Match (20 pts)
    eligibility_text = f"{opportunity.get('eligibility', '')} {(' '.join(opportunity.get('requirements') or []))}".lower()
    
    degree = str(profile.get("degree") or "").lower()
    branch = str(profile.get("branch") or "").lower()
    study_year = str(profile.get("study_year") or "").lower()

    bg_score = 10.0  # Base assumption of baseline eligibility
    if degree and (degree in eligibility_text or "student" in eligibility_text or "undergraduate" in eligibility_text):
        bg_score += 4.0
    if branch and (branch in eligibility_text or "engineering" in eligibility_text or "science" in eligibility_text or "technology" in eligibility_text):
        bg_score += 4.0
    if study_year and (study_year in eligibility_text or "year" in eligibility_text):
        bg_score += 2.0

    score += min(bg_score, 20.0)

    # Return clamped integer 0-100
    return max(0, min(100, int(round(score))))
